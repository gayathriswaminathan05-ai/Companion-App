// Google Calendar — meeting reminders only.
// PRIVACY: OAuth tokens may live in userData. Event titles/times are fetched
// into RAM, used once to fire a reminder, then discarded. Never written to
// companion-data.json. Never sent to Claude.
const { shell, ipcMain } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** @type {import('electron').BrowserWindow | null} */
let winRef = null;
/** @type {(() => string) | null} */
let userDataPath = null;

/** Opaque event ids we've already nudged this session (no titles stored). */
const notifiedIds = new Set();
let pollTimer = null;
let authServer = null;

function clientFile() {
  return path.join(userDataPath(), "google-calendar-client.json");
}
function tokenFile() {
  return path.join(userDataPath(), "google-calendar.token.json");
}

function loadClient() {
  try {
    const j = JSON.parse(fs.readFileSync(clientFile(), "utf8"));
    if (j.clientId && j.clientSecret) return j;
  } catch {}
  // Optional env for founders / local dev
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
  // tokens only — never event payloads
  fs.writeFileSync(
    tokenFile(),
    JSON.stringify(
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
}

function clearTokens() {
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

async function refreshAccessIfNeeded() {
  const tokens = loadTokens();
  if (!tokens?.refresh_token) return null;
  const client = loadClient();
  if (!client) return null;
  const stillFresh =
    tokens.access_token && tokens.expiry_date && Date.now() < tokens.expiry_date - 60_000;
  if (stillFresh) return tokens.access_token;

  const body = new URLSearchParams({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    refresh_token: tokens.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;
  const json = await res.json();
  const next = {
    access_token: json.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: Date.now() + (json.expires_in || 3600) * 1000,
  };
  saveTokens(next);
  return next.access_token;
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
    if (!on || !winRef || winRef.isDestroyed()) return;
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
      winRef.webContents.send("calendar-meeting", {
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

function startPolling(dataFile) {
  stopPolling();
  pollTimer = setInterval(() => void pollMeetings(dataFile), 45_000);
  // first check soon after connect / launch
  setTimeout(() => void pollMeetings(dataFile), 4000);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

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
          <p>${err ? String(err) : "You can close this tab and go back to Companion."}</p>
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
  authUrl.searchParams.set("scope", SCOPE);
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
  if (!json.refresh_token && !loadTokens()?.refresh_token) {
    throw new Error("Google did not return a refresh token — try disconnecting the app in your Google account and connect again");
  }
  saveTokens({
    access_token: json.access_token,
    refresh_token: json.refresh_token || loadTokens()?.refresh_token,
    expiry_date: Date.now() + (json.expires_in || 3600) * 1000,
  });
}

/**
 * @param {{ getUserDataPath: () => string, getWindow: () => import('electron').BrowserWindow | null, dataFile: () => string }} opts
 */
function registerCalendarIpc(opts) {
  userDataPath = opts.getUserDataPath;
  winRef = null;

  const bindWin = () => {
    winRef = opts.getWindow();
  };

  ipcMain.handle("calendar-status", () => {
    bindWin();
    const client = loadClient();
    const tokens = loadTokens();
    return {
      hasClient: !!client,
      connected: !!(tokens && tokens.refresh_token),
    };
  });

  ipcMain.handle("calendar-save-client", (_e, { clientId, clientSecret }) => {
    if (!clientId || !clientSecret) return { ok: false, error: "need both id and secret" };
    saveClient(clientId, clientSecret);
    return { ok: true };
  });

  ipcMain.handle("calendar-connect", async () => {
    bindWin();
    try {
      await runOAuthConnect();
      startPolling(opts.dataFile);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle("calendar-disconnect", () => {
    clearTokens();
    stopPolling();
    return { ok: true };
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
    bindWin();
    if (loadTokens()?.refresh_token) startPolling(opts.dataFile);
  }, 2500);
}

module.exports = { registerCalendarIpc, clearTokens, clearClient, stopPolling };
