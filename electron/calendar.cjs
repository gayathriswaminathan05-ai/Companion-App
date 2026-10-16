// Google connection — Calendar (meeting reminders + create events) and Gmail
// new-mail alerts (see gmail.cjs). One Connect button, one set of tokens.
// PRIVACY (binding, PRD §6b):
//  - Disk holds ONLY OAuth tokens (+ the granted scope string) and the Google
//    client id/secret. Nothing else.
//  - Event titles/times are fetched into RAM, used once to fire a reminder,
//    then discarded. Never written to companion-data.json. Never sent to Claude.
//  - Creating an event sends the title/time the user asked for to Google
//    Calendar only (that's the point). We don't keep a copy.
//  - Gmail: metadata scope only (headers/labels, never bodies). See gmail.cjs.
const { shell, ipcMain } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { createGmailWatcher } = require("./gmail.cjs");

// Scopes we ask for on Connect.
const SCOPE_CAL_EVENTS = "https://www.googleapis.com/auth/calendar.events"; // read + create events
const SCOPE_GMAIL_METADATA = "https://www.googleapis.com/auth/gmail.metadata"; // headers/labels, NO bodies
// Gmail alerts are switched OFF for now (owner, Oct 16): the Gmail scope is
// "restricted" (paid yearly security assessment to go public). Keep in sync
// with src/features.ts FEATURES.gmailAlerts.
const GMAIL_FEATURE = false;
const SCOPES = GMAIL_FEATURE ? [SCOPE_CAL_EVENTS, SCOPE_GMAIL_METADATA] : [SCOPE_CAL_EVENTS];
// Older / broader scopes we may find in a saved grant.
const SCOPE_CAL_READONLY = "https://www.googleapis.com/auth/calendar.readonly"; // first-version connect
const SCOPE_CAL_EVENTS_READONLY = "https://www.googleapis.com/auth/calendar.events.readonly";
const SCOPE_CAL_FULL = "https://www.googleapis.com/auth/calendar";
const SCOPE_GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
const SCOPE_GMAIL_MODIFY = "https://www.googleapis.com/auth/gmail.modify";
const SCOPE_MAIL_FULL = "https://mail.google.com/";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Client id/secret shipped inside the app for beta testers (gitignored; the
// build copies it in) so they can just click Connect.
const BUNDLED_CLIENT_FILE = path.join(__dirname, "google-client.json");

/** @type {(() => import('electron').BrowserWindow | null) | null} */
let getWindowFn = null;
/** @type {(() => string) | null} */
let userDataPath = null;

/** Opaque event ids we've already nudged this session (no titles stored). */
const notifiedIds = new Set();
let pollTimer = null;
let firstPollTimer = null;
let authServer = null;
/** Gmail alerts on/off — RAM only; the renderer sends its setting on launch. */
let gmailEnabled = false;
/** Bumped whenever tokens are wiped, so an in-flight refresh can't resurrect them. */
let tokenGeneration = 0;
let refreshInFlight = null;
let authExpiredNotified = false;

const gmail = createGmailWatcher({
  getAccessToken: () => refreshAccessIfNeeded(),
  getWindow: () => currentWindow(),
});

function currentWindow() {
  const w = getWindowFn ? getWindowFn() : null;
  return w && !w.isDestroyed() ? w : null;
}

function clientFile() {
  return path.join(userDataPath(), "google-calendar-client.json");
}
function tokenFile() {
  return path.join(userDataPath(), "google-calendar.token.json");
}

/** Accepts our shape {clientId, clientSecret} or Google's downloaded {installed:{client_id, client_secret}}. */
function readClientFile(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    const src = j && j.installed ? j.installed : j;
    const clientId = src && (src.clientId || src.client_id);
    const clientSecret = src && (src.clientSecret || src.client_secret);
    if (clientId && clientSecret) {
      return { clientId: String(clientId).trim(), clientSecret: String(clientSecret).trim() };
    }
  } catch {}
  return null;
}

// Order: user-saved (Settings) → bundled with the app → env (founders / local dev).
function loadClient() {
  const saved = userDataPath ? readClientFile(clientFile()) : null;
  if (saved) return saved;
  const bundled = readClientFile(BUNDLED_CLIENT_FILE);
  if (bundled) return bundled;
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  return null;
}

function saveClient(clientId, clientSecret) {
  fs.writeFileSync(
    clientFile(),
    JSON.stringify({ clientId: String(clientId).trim(), clientSecret: String(clientSecret).trim() }, null, 2),
    { mode: 0o600 },
  );
}

function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(tokenFile(), "utf8"));
  } catch {
    return null;
  }
}

function saveTokens(tokens) {
  // tokens + granted scope string only — never event or email payloads
  fs.writeFileSync(
    tokenFile(),
    JSON.stringify(
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        scope: tokens.scope,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
}

function clearTokens() {
  tokenGeneration++;
  try {
    fs.unlinkSync(tokenFile());
  } catch {}
  notifiedIds.clear();
}

function clearClient() {
  try {
    fs.unlinkSync(clientFile());
  } catch {}
}

/** Scopes the user actually granted (they can untick boxes on Google's consent screen). */
function grantedScopes(tokens) {
  if (!tokens || !tokens.refresh_token) return [];
  if (typeof tokens.scope === "string" && tokens.scope.trim()) return tokens.scope.trim().split(/\s+/);
  // Connected before we saved scopes = the first version, which only asked calendar.readonly.
  return [SCOPE_CAL_READONLY];
}

/** @returns {{ connected: boolean, canReadEvents: boolean, canCreateEvents: boolean, gmail: boolean }} */
function scopeFlags(tokens) {
  const s = new Set(grantedScopes(tokens));
  const has = (...xs) => xs.some((x) => s.has(x));
  return {
    connected: !!(tokens && tokens.refresh_token),
    canReadEvents: has(SCOPE_CAL_READONLY, SCOPE_CAL_EVENTS, SCOPE_CAL_EVENTS_READONLY, SCOPE_CAL_FULL),
    canCreateEvents: has(SCOPE_CAL_EVENTS, SCOPE_CAL_FULL),
    gmail: has(SCOPE_GMAIL_METADATA, SCOPE_GMAIL_READONLY, SCOPE_GMAIL_MODIFY, SCOPE_MAIL_FULL),
  };
}

/** Google said the saved grant is dead (revoked, or Testing-mode 7-day expiry). */
function onGrantRevoked() {
  clearTokens();
  stopPolling();
  if (!authExpiredNotified) {
    authExpiredNotified = true;
    const w = currentWindow();
    if (w) w.webContents.send("google-auth-expired");
  }
}

async function doRefresh(tokens, client) {
  const gen = tokenGeneration;
  const body = new URLSearchParams({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    refresh_token: tokens.refresh_token,
    grant_type: "refresh_token",
  });
  let res;
  try {
    res = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    return { token: null, error: "couldn't reach Google (offline?)" };
  }
  if (!res.ok) {
    let j = {};
    try {
      j = await res.json();
    } catch {}
    if (j && j.error === "invalid_grant") {
      if (gen === tokenGeneration) onGrantRevoked();
      return { token: null, error: "Google access expired — please reconnect", needsReconnect: true };
    }
    return { token: null, error: `Google sign-in refresh failed (${res.status})` };
  }
  const json = await res.json();
  const next = {
    access_token: json.access_token,
    refresh_token: json.refresh_token || tokens.refresh_token,
    expiry_date: Date.now() + (json.expires_in || 3600) * 1000,
    scope: json.scope || tokens.scope,
  };
  // Disconnected while we were waiting? Don't write the tokens back.
  if (gen !== tokenGeneration) return { token: null, error: "disconnected", needsReconnect: true };
  saveTokens(next);
  return { token: next.access_token };
}

/**
 * Shared token helper (calendar polling, create-event, gmail).
 * @returns {Promise<{ token: string | null, error?: string, needsReconnect?: boolean }>}
 */
async function getAccessToken({ force = false } = {}) {
  const tokens = loadTokens();
  if (!tokens || !tokens.refresh_token) {
    return { token: null, error: "Google isn't connected", needsReconnect: true };
  }
  const client = loadClient();
  if (!client) return { token: null, error: "missing Google client id/secret", needsReconnect: true };
  const stillFresh =
    !force && tokens.access_token && tokens.expiry_date && Date.now() < tokens.expiry_date - 60_000;
  if (stillFresh) return { token: tokens.access_token };
  // One refresh at a time (calendar + gmail polls can overlap).
  if (!refreshInFlight) {
    refreshInFlight = doRefresh(tokens, client).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function refreshAccessIfNeeded() {
  try {
    const r = await getAccessToken();
    return r.token || null;
  } catch {
    return null;
  }
}

/**
 * Fetch upcoming events into memory only. Caller must not persist.
 * @returns {Promise<{ id: string, title: string, startMs: number }[]>}
 */
async function fetchUpcomingEvents() {
  const access = await refreshAccessIfNeeded();
  if (!access) return [];
  const now = new Date();
  const until = new Date(now.getTime() + 3 * 60 * 60 * 1000); // next 3h only
  const url = new URL(EVENTS);
  url.searchParams.set("timeMin", now.toISOString());
  url.searchParams.set("timeMax", until.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "12");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const out = [];
  for (const item of json.items || []) {
    if (item.status === "cancelled") continue;
    // Skip all-day (date only, no dateTime)
    const start = item.start?.dateTime;
    if (!start) continue;
    const startMs = new Date(start).getTime();
    if (!Number.isFinite(startMs)) continue;
    out.push({
      id: String(item.id),
      title: String(item.summary || "meeting").slice(0, 80),
      startMs,
    });
  }
  return out;
}

function readLeadSettings(dataFile) {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile(), "utf8"));
    const on = data.settings?.calendarReminders !== false;
    const lead = Number(data.settings?.calendarLeadMins);
    return {
      on: !!on && !!loadTokens()?.refresh_token,
      lead: Number.isFinite(lead) ? Math.min(60, Math.max(5, lead)) : 10,
    };
  } catch {
    return { on: !!loadTokens()?.refresh_token, lead: 10 };
  }
}

async function pollMeetings(dataFile) {
  try {
    const { on, lead } = readLeadSettings(dataFile);
    const win = currentWindow();
    if (!on || !win) return;
    // They may have unticked Calendar on Google's consent screen.
    if (!scopeFlags(loadTokens()).canReadEvents) return;
    const events = await fetchUpcomingEvents();
    const now = Date.now();
    // Fire when meeting is within [lead, lead-1] minutes… or already inside the
    // lead window and we haven't notified yet (app was asleep).
    for (const e of events) {
      const mins = (e.startMs - now) / 60_000;
      if (mins < -1 || mins > lead) continue;
      if (notifiedIds.has(e.id)) continue;
      notifiedIds.add(e.id);
      const minutesUntil = Math.max(0, Math.round(mins));
      const w = currentWindow();
      if (!w) return;
      w.webContents.send("calendar-meeting", {
        id: e.id,
        title: e.title,
        minutesUntil,
      });
    }
    // events array goes out of scope — not written anywhere
  } catch {
    /* ignore network blips */
  }
}

/** Gmail alerts run only when: connected + gmail scope granted + user turned them on. */
function syncGmail() {
  if (!userDataPath) return;
  const f = scopeFlags(loadTokens());
  if (GMAIL_FEATURE && gmailEnabled && f.connected && f.gmail) gmail.start();
  else gmail.stop();
}

function stopMeetingPolling() {
  if (pollTimer) clearInterval(pollTimer);
  if (firstPollTimer) clearTimeout(firstPollTimer);
  pollTimer = null;
  firstPollTimer = null;
}

function startPolling(dataFile) {
  stopMeetingPolling();
  pollTimer = setInterval(() => void pollMeetings(dataFile), 45_000);
  // first check soon after connect / launch
  firstPollTimer = setTimeout(() => void pollMeetings(dataFile), 4000);
  syncGmail();
}

/** Stops meeting pings AND gmail alerts (disconnect / delete-everything). */
function stopPolling() {
  stopMeetingPolling();
  gmail.stop();
}

// ---------- creating events ----------

const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
const pad = (n) => String(n).padStart(2, "0");
const wallFromUTC = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes(),
  )}:${pad(d.getUTCSeconds())}`;

function offsetMinutes(offset) {
  if (!offset || offset === "Z") return 0;
  const sign = offset[0] === "-" ? -1 : 1;
  return sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
}

/**
 * "2026-10-20T15:00:00+05:30" (exact moment) or "2026-10-20T15:00" (local
 * wall-clock, read in the event's time zone). Also accepts Date / epoch ms.
 * @returns {{ dateTime: string, offset: string | null, ms: number } | null}
 */
function parseWhen(v) {
  if (v instanceof Date || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return null;
    return { dateTime: wallFromUTC(d) + "Z", offset: "Z", ms: d.getTime() };
  }
  const m = String(v || "").trim().match(ISO_RE);
  if (!m) return null;
  const [, Y, Mo, D, h, mi, sec = "00", rawOff] = m;
  const check = new Date(Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +sec));
  if (check.getUTCMonth() !== +Mo - 1 || check.getUTCDate() !== +D || +h > 23 || +mi > 59 || +sec > 59) {
    return null;
  }
  const wall = `${Y}-${Mo}-${D}T${h}:${mi}:${sec}`;
  if (rawOff) {
    const offset =
      rawOff.toUpperCase() === "Z" ? "Z" : rawOff.length === 5 ? `${rawOff.slice(0, 3)}:${rawOff.slice(3)}` : rawOff;
    const ms = check.getTime() - offsetMinutes(offset) * 60_000;
    return { dateTime: wall + offset, offset, ms };
  }
  // local wall-clock; ms here is only used for sanity checks (end > start)
  return { dateTime: wall, offset: null, ms: new Date(+Y, +Mo - 1, +D, +h, +mi, +sec).getTime() };
}

function addMinutes(w, mins) {
  const delta = mins * 60_000;
  if (w.offset === null) {
    // pure wall-clock math; Google applies the time zone
    const [d, t] = w.dateTime.split("T");
    const [Y, Mo, D] = d.split("-").map(Number);
    const [h, mi, s] = t.split(":").map(Number);
    return { dateTime: wallFromUTC(new Date(Date.UTC(Y, Mo - 1, D, h, mi, s) + delta)), offset: null, ms: w.ms + delta };
  }
  const ms = w.ms + delta;
  const shifted = new Date(ms + offsetMinutes(w.offset) * 60_000);
  return { dateTime: wallFromUTC(shifted) + w.offset, offset: w.offset, ms };
}

function machineTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

/**
 * Pure: turns the renderer's request into the Google API call. No network.
 * @returns {{ url: string, body: object } | { error: string }}
 */
function buildEventRequest(input) {
  const { title, start, end, description, attendees, timeZone } = input || {};
  const summary = String(title || "").replace(/\s+/g, " ").trim();
  if (!summary) return { error: "the event needs a title" };
  const s = parseWhen(start);
  if (!s) return { error: "couldn't understand the start time" };
  let e;
  if (end === undefined || end === null || end === "") e = addMinutes(s, 30);
  else {
    e = parseWhen(end);
    if (!e) return { error: "couldn't understand the end time" };
  }
  if (e.ms <= s.ms) return { error: "the end time is before the start time" };

  let tz = typeof timeZone === "string" && timeZone.trim() ? timeZone.trim() : machineTimeZone();
  try {
    if (tz) new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    if (typeof timeZone === "string" && timeZone.trim()) return { error: `unknown time zone: ${timeZone}` };
    tz = "";
  }
  const when = (w) => {
    if (tz) return { dateTime: w.dateTime, timeZone: tz };
    // no zone name available → pin local wall-clock to this machine's offset
    if (w.offset !== null) return { dateTime: w.dateTime };
    const off = -new Date(w.ms).getTimezoneOffset();
    const sign = off < 0 ? "-" : "+";
    return { dateTime: `${w.dateTime}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}` };
  };

  const body = { summary: summary.slice(0, 300), start: when(s), end: when(e) };
  const desc = String(description || "").trim();
  if (desc) body.description = desc.slice(0, 8000);

  const emails = [];
  for (const a of Array.isArray(attendees) ? attendees : []) {
    const em = String(a || "").trim();
    if (!em) continue;
    if (!EMAIL_RE.test(em)) return { error: `that doesn't look like an email address: ${em}` };
    if (!emails.some((x) => x.toLowerCase() === em.toLowerCase())) emails.push(em);
  }
  if (emails.length > 50) return { error: "too many guests (max 50)" };
  if (emails.length) body.attendees = emails.map((email) => ({ email }));

  const url = new URL(EVENTS);
  // Only email invites when there are guests; otherwise stay silent.
  url.searchParams.set("sendUpdates", emails.length ? "all" : "none");
  return { url: url.toString(), body };
}

function isScopeError(status, err) {
  if (status !== 403) return false;
  const reasons = [
    ...((err && err.errors) || []).map((x) => x && x.reason),
    ...((err && err.details) || []).map((x) => x && x.reason),
  ].map((r) => String(r || ""));
  return (
    reasons.some((r) => r === "insufficientPermissions" || r === "ACCESS_TOKEN_SCOPE_INSUFFICIENT") ||
    /insufficient (authentication )?scopes?/i.test(String((err && err.message) || ""))
  );
}

/**
 * @returns {Promise<{ ok: true, id: string, htmlLink: string, start: string, end: string }
 *   | { ok: false, error: string, needsReconnect?: boolean }>}
 */
async function createEvent(input) {
  const tokens = loadTokens();
  const flags = scopeFlags(tokens);
  if (!flags.connected) return { ok: false, error: "Google isn't connected", needsReconnect: true };
  if (!flags.canCreateEvents) {
    return { ok: false, error: "Calendar is connected read-only — reconnect Google to let me add events", needsReconnect: true };
  }
  const built = buildEventRequest(input);
  if ("error" in built) return { ok: false, error: built.error };

  try {
    let auth = await getAccessToken();
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!auth.token) {
        return { ok: false, error: auth.error || "Google sign-in failed", ...(auth.needsReconnect ? { needsReconnect: true } : {}) };
      }
      const res = await fetch(built.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(built.body),
      });
      if (res.ok) {
        const j = await res.json();
        return {
          ok: true,
          id: String(j.id || ""),
          htmlLink: String(j.htmlLink || ""),
          start: j.start?.dateTime || j.start?.date || built.body.start.dateTime,
          end: j.end?.dateTime || j.end?.date || built.body.end.dateTime,
        };
      }
      // 401 = access token stale (nothing was created) → refresh once and retry
      if (res.status === 401 && attempt === 0) {
        auth = await getAccessToken({ force: true });
        continue;
      }
      let err = {};
      try {
        err = (await res.json()).error || {};
      } catch {}
      if (res.status === 401) return { ok: false, error: "Google sign-in expired — please reconnect", needsReconnect: true };
      if (isScopeError(res.status, err)) {
        return { ok: false, error: "I don't have permission to add events — reconnect Google", needsReconnect: true };
      }
      return { ok: false, error: String(err.message || `Google Calendar error ${res.status}`).slice(0, 200) };
    }
    return { ok: false, error: "Google sign-in failed" };
  } catch {
    return { ok: false, error: "couldn't reach Google (offline?)" };
  }
}

// ---------- OAuth connect ----------

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function listenForCode(port) {
  return new Promise((resolve, reject) => {
    if (authServer) {
      try {
        authServer.close();
      } catch {}
      authServer = null;
    }
    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url || "/", `http://127.0.0.1:${port}`);
        if (u.pathname !== "/") {
          res.writeHead(404);
          res.end();
          return;
        }
        const err = u.searchParams.get("error");
        const code = u.searchParams.get("code");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          `<!doctype html><html><body style="font-family:system-ui;padding:40px;background:#f3f3f3;color:#201d2f">
          <h2>${err ? "Couldn't connect" : "Connected ✓"}</h2>
          <p>${err ? escapeHtml(err) : "You can close this tab and go back to Companion."}</p>
          </body></html>`,
        );
        server.close();
        authServer = null;
        if (err) reject(new Error(err));
        else if (!code) reject(new Error("no code"));
        else resolve(code);
      } catch (e) {
        reject(e);
      }
    });
    authServer = server;
    server.listen(port, "127.0.0.1");
    server.on("error", reject);
    setTimeout(() => {
      try {
        server.close();
      } catch {}
      authServer = null;
      reject(new Error("auth timed out"));
    }, 5 * 60_000);
  });
}

async function runOAuthConnect() {
  const client = loadClient();
  if (!client) throw new Error("missing Google client id/secret");

  // Pick a free loopback port
  const port = await new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
    s.on("error", reject);
  });

  const redirectUri = `http://127.0.0.1:${port}`;
  const codePromise = listenForCode(port);

  const authUrl = new URL(AUTH);
  authUrl.searchParams.set("client_id", client.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");

  await shell.openExternal(authUrl.toString());
  const code = await codePromise;

  const body = new URLSearchParams({
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("token exchange failed: " + t.slice(0, 200));
  }
  const json = await res.json();
  const previous = loadTokens();
  if (!json.refresh_token && !previous?.refresh_token) {
    throw new Error("Google did not return a refresh token — try disconnecting the app in your Google account and connect again");
  }
  saveTokens({
    access_token: json.access_token,
    refresh_token: json.refresh_token || previous?.refresh_token,
    expiry_date: Date.now() + (json.expires_in || 3600) * 1000,
    // What they actually granted (they may untick Gmail or Calendar).
    scope: json.scope || SCOPES.join(" "),
  });
  authExpiredNotified = false;
}

function statusFlags() {
  const f = scopeFlags(loadTokens());
  return {
    hasClient: !!loadClient(),
    connected: f.connected,
    canCreateEvents: f.canCreateEvents,
    gmail: f.gmail,
  };
}

/**
 * @param {{ getUserDataPath: () => string, getWindow: () => import('electron').BrowserWindow | null, dataFile: () => string }} opts
 */
function registerCalendarIpc(opts) {
  userDataPath = opts.getUserDataPath;
  getWindowFn = opts.getWindow;

  // → { hasClient, connected, canCreateEvents, gmail }
  // connected && !canCreateEvents = old read-only connect → UI should offer "Reconnect".
  ipcMain.handle("calendar-status", () => statusFlags());

  ipcMain.handle("calendar-save-client", (_e, creds) => {
    const { clientId, clientSecret } = creds || {};
    if (!clientId || !clientSecret) return { ok: false, error: "need both id and secret" };
    saveClient(clientId, clientSecret);
    return { ok: true };
  });

  // Also used as "Reconnect" (upgrades old read-only grants).
  ipcMain.handle("calendar-connect", async () => {
    try {
      await runOAuthConnect();
      // Fresh Gmail baseline (could be a different Google account now).
      gmail.stop();
      startPolling(opts.dataFile);
      const s = statusFlags();
      return { ok: true, canCreateEvents: s.canCreateEvents, gmail: s.gmail };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle("calendar-disconnect", () => {
    clearTokens();
    stopPolling();
    return { ok: true };
  });

  // { title, start, end?, description?, attendees?: string[], timeZone? }
  ipcMain.handle("calendar-create-event", (_e, input) => createEvent(input));

  // Gmail new-mail alerts on/off (renderer setting; default off until called).
  ipcMain.handle("gmail-set-enabled", (_e, on) => {
    gmailEnabled = (on && typeof on === "object" ? on.enabled : on) === true;
    syncGmail();
    return { ok: true, enabled: gmailEnabled, active: gmail.isRunning() };
  });

  // Wipe tokens on full data reset (called from main data-reset too)
  ipcMain.handle("calendar-clear-all", () => {
    clearTokens();
    clearClient();
    stopPolling();
    notifiedIds.clear();
    return { ok: true };
  });

  // Start polling if already connected
  setTimeout(() => {
    if (loadTokens()?.refresh_token) startPolling(opts.dataFile);
  }, 2500);
}

module.exports = {
  registerCalendarIpc,
  clearTokens,
  clearClient,
  stopPolling,
  // pure helpers, exported for the offline dev test (electron/test-google.cjs)
  _internals: { scopeFlags, buildEventRequest, parseWhen, readClientFile, gmail, BUNDLED_CLIENT_FILE, SCOPES },
};
