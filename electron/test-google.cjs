// DEV-ONLY offline test for calendar.cjs + gmail.cjs. Not loaded by the app.
// No real Google calls: `fetch` and the `electron` module are faked.
// Run from the repo root:  node electron/test-google.cjs
const Module = require("module");
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// ---- tiny fake electron (only what calendar.cjs touches) ----
const handlers = {};
const fakeElectron = {
  ipcMain: { handle: (ch, fn) => (handlers[ch] = fn) },
  shell: { openExternal: async () => {} },
};
const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "electron") return fakeElectron;
  return realLoad.call(this, req, ...rest);
};

// ---- fake fetch: route by URL, record calls ----
let calls = [];
let routes = []; // [{ match: (url, init) => bool, reply: (url, init) => ({status, json}) }]
global.fetch = async (url, init = {}) => {
  const u = String(url);
  calls.push({ url: u, init });
  const r = routes.find((x) => x.match(u, init));
  if (!r) throw new Error("unexpected fetch " + u);
  const { status = 200, json = {} } = r.reply(u, init);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
    text: async () => JSON.stringify(json),
  };
};
const resetNet = () => {
  calls = [];
  routes = [];
};

// ---- fake window ----
const sent = [];
let visible = true;
const fakeWin = {
  isDestroyed: () => false,
  isVisible: () => visible,
  webContents: { send: (ch, payload) => sent.push([ch, payload]) },
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "companion-google-test-"));
const tokenPath = path.join(tmp, "google-calendar.token.json");
const writeTokens = (t) => fs.writeFileSync(tokenPath, JSON.stringify(t));
const FULL = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.metadata";
const fresh = (scope) => ({
  access_token: "AT",
  refresh_token: "RT",
  expiry_date: Date.now() + 3600_000,
  ...(scope !== undefined ? { scope } : {}),
});

delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;

const cal = require("./calendar.cjs");
const { senderName, cleanSubject, createGmailWatcher } = require("./gmail.cjs");
const { scopeFlags, buildEventRequest, BUNDLED_CLIENT_FILE } = cal._internals;
cal.registerCalendarIpc({
  getUserDataPath: () => tmp,
  getWindow: () => fakeWin,
  dataFile: () => path.join(tmp, "companion-data.json"),
});

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---------------- scopes → status ----------------
test("scope parsing → flags", () => {
  assert.deepStrictEqual(scopeFlags(null), { connected: false, canReadEvents: false, canCreateEvents: false, gmail: false });
  // legacy: connected before scopes were saved = calendar.readonly
  assert.deepStrictEqual(scopeFlags({ refresh_token: "x" }), {
    connected: true, canReadEvents: true, canCreateEvents: false, gmail: false,
  });
  assert.deepStrictEqual(scopeFlags({ refresh_token: "x", scope: FULL }), {
    connected: true, canReadEvents: true, canCreateEvents: true, gmail: true,
  });
  // unticked Gmail on Google's consent screen
  const noMail = scopeFlags({ refresh_token: "x", scope: "https://www.googleapis.com/auth/calendar.events" });
  assert.strictEqual(noMail.gmail, false);
  assert.strictEqual(noMail.canCreateEvents, true);
  // include_granted_scopes on an old user → readonly + new ones
  const upgraded = scopeFlags({ refresh_token: "x", scope: "https://www.googleapis.com/auth/calendar.readonly " + FULL });
  assert.strictEqual(upgraded.canCreateEvents, true);
});

test("calendar-status: env client, legacy vs full tokens", async () => {
  if (fs.existsSync(BUNDLED_CLIENT_FILE)) {
    console.log("   (bundled google-client.json present — hasClient=false case skipped)");
  } else {
    assert.strictEqual((await handlers["calendar-status"]()).hasClient, false);
  }
  process.env.GOOGLE_CLIENT_ID = "cid";
  process.env.GOOGLE_CLIENT_SECRET = "csecret";
  assert.deepStrictEqual(await handlers["calendar-status"](), {
    hasClient: true, connected: false, canCreateEvents: false, gmail: false,
  });
  writeTokens({ access_token: "AT", refresh_token: "RT", expiry_date: Date.now() + 3600_000 });
  assert.deepStrictEqual(await handlers["calendar-status"](), {
    hasClient: true, connected: true, canCreateEvents: false, gmail: false,
  });
  writeTokens(fresh(FULL));
  assert.deepStrictEqual(await handlers["calendar-status"](), {
    hasClient: true, connected: true, canCreateEvents: true, gmail: true,
  });
});

test("loadClient order: userData → bundled → env (and Google's downloaded JSON shape)", async () => {
  const { readClientFile } = cal._internals;
  const g = path.join(tmp, "dl.json");
  fs.writeFileSync(g, JSON.stringify({ installed: { client_id: " a ", client_secret: "b" } }));
  assert.deepStrictEqual(readClientFile(g), { clientId: "a", clientSecret: "b" });
  if (!fs.existsSync(BUNDLED_CLIENT_FILE)) {
    fs.writeFileSync(BUNDLED_CLIENT_FILE, JSON.stringify({ clientId: "bundled", clientSecret: "s" }));
    try {
      // bundled beats env: refresh request must use the bundled client id
      writeTokens({ ...fresh(FULL), expiry_date: 0 });
      resetNet();
      routes.push({ match: (u) => u.startsWith("https://oauth2.googleapis.com/token"), reply: () => ({ json: { access_token: "NEW", expires_in: 3600 } }) });
      routes.push({ match: (u) => u.includes("/calendar/v3/"), reply: () => ({ json: { id: "e1", htmlLink: "L" } }) });
      await handlers["calendar-create-event"](null, { title: "x", start: "2026-10-20T10:00:00Z" });
      assert.strictEqual(new URLSearchParams(calls[0].init.body.toString()).get("client_id"), "bundled");
      // userData beats bundled
      await handlers["calendar-save-client"](null, { clientId: "mine", clientSecret: "s2" });
      writeTokens({ ...fresh(FULL), expiry_date: 0 });
      resetNet();
      routes.push({ match: (u) => u.startsWith("https://oauth2.googleapis.com/token"), reply: () => ({ json: { access_token: "NEW", expires_in: 3600 } }) });
      routes.push({ match: (u) => u.includes("/calendar/v3/"), reply: () => ({ json: { id: "e1", htmlLink: "L" } }) });
      await handlers["calendar-create-event"](null, { title: "x", start: "2026-10-20T10:00:00Z" });
      assert.strictEqual(new URLSearchParams(calls[0].init.body.toString()).get("client_id"), "mine");
      // refresh kept the granted scope string + refresh token
      const saved = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
      assert.strictEqual(saved.scope, FULL);
      assert.strictEqual(saved.refresh_token, "RT");
      assert.strictEqual(saved.access_token, "NEW");
      assert.deepStrictEqual(Object.keys(saved).sort(), ["access_token", "expiry_date", "refresh_token", "scope"]);
    } finally {
      fs.unlinkSync(BUNDLED_CLIENT_FILE);
      cal.clearClient();
    }
  } else {
    console.log("   (bundled google-client.json present — order test skipped so we don't touch it)");
  }
});

// ---------------- create event ----------------
test("create-event: URL, body, default +30min, sendUpdates=none", async () => {
  writeTokens(fresh(FULL));
  resetNet();
  routes.push({
    match: (u) => u.startsWith("https://www.googleapis.com/calendar/v3/calendars/primary/events"),
    reply: (u, init) => {
      const b = JSON.parse(init.body);
      return { json: { id: "ev1", htmlLink: "https://cal/ev1", start: b.start, end: b.end } };
    },
  });
  const r = await handlers["calendar-create-event"](null, {
    title: "  Call   amma ",
    start: "2026-10-20T23:45:00+05:30",
    description: "bring tea",
    timeZone: "Asia/Kolkata",
  });
  assert.strictEqual(calls.length, 1);
  const { url, init } = calls[0];
  assert.strictEqual(url, "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none");
  assert.strictEqual(init.method, "POST");
  assert.strictEqual(init.headers.Authorization, "Bearer AT");
  assert.deepStrictEqual(JSON.parse(init.body), {
    summary: "Call amma",
    start: { dateTime: "2026-10-20T23:45:00+05:30", timeZone: "Asia/Kolkata" },
    end: { dateTime: "2026-10-21T00:15:00+05:30", timeZone: "Asia/Kolkata" },
    description: "bring tea",
  });
  assert.deepStrictEqual(r, {
    ok: true, id: "ev1", htmlLink: "https://cal/ev1",
    start: "2026-10-20T23:45:00+05:30", end: "2026-10-21T00:15:00+05:30",
  });
});

test("create-event: attendees → sendUpdates=all; local ISO keeps wall-clock + zone", async () => {
  writeTokens(fresh(FULL));
  resetNet();
  routes.push({ match: (u) => u.includes("/calendar/v3/"), reply: () => ({ json: { id: "ev2", htmlLink: "L" } }) });
  const r = await handlers["calendar-create-event"](null, {
    title: "Sync",
    start: "2026-10-20T15:00",
    end: "2026-10-20T16:15",
    attendees: ["riya@x.com", " Riya@x.com ", "sam@y.org"],
    timeZone: "America/New_York",
  });
  assert.strictEqual(r.ok, true);
  assert.ok(calls[0].url.endsWith("?sendUpdates=all"));
  const b = JSON.parse(calls[0].init.body);
  assert.deepStrictEqual(b.attendees, [{ email: "riya@x.com" }, { email: "sam@y.org" }]);
  assert.deepStrictEqual(b.start, { dateTime: "2026-10-20T15:00:00", timeZone: "America/New_York" });
  assert.deepStrictEqual(b.end, { dateTime: "2026-10-20T16:15:00", timeZone: "America/New_York" });
  // falls back to the response values we sent when Google omits them
  assert.strictEqual(r.start, "2026-10-20T15:00:00");
});

test("create-event: validation errors (no network)", () => {
  assert.ok(buildEventRequest({ start: "2026-10-20T15:00" }).error);
  assert.ok(buildEventRequest({ title: "x", start: "tomorrow-ish" }).error);
  assert.ok(buildEventRequest({ title: "x", start: "2026-02-30T10:00" }).error);
  assert.ok(buildEventRequest({ title: "x", start: "2026-10-20T15:00", end: "2026-10-20T14:00" }).error);
  assert.ok(buildEventRequest({ title: "x", start: "2026-10-20T15:00", attendees: ["not-an-email"] }).error);
  assert.ok(buildEventRequest({ title: "x", start: "2026-10-20T15:00", timeZone: "Mars/Olympus" }).error);
  // local default end crosses midnight
  assert.strictEqual(buildEventRequest({ title: "x", start: "2026-12-31T23:50" }).body.end.dateTime, "2027-01-01T00:20:00");
  // Z offset
  assert.strictEqual(buildEventRequest({ title: "x", start: "2026-10-20T10:00:00.000Z" }).body.end.dateTime, "2026-10-20T10:30:00Z");
});

test("create-event: legacy read-only grant → needsReconnect, no network", async () => {
  writeTokens({ access_token: "AT", refresh_token: "RT", expiry_date: Date.now() + 3600_000 });
  resetNet();
  const r = await handlers["calendar-create-event"](null, { title: "x", start: "2026-10-20T10:00:00Z" });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.needsReconnect, true);
  assert.strictEqual(calls.length, 0);
});

test("create-event: 403 insufficient scope → needsReconnect; other 403 → not", async () => {
  writeTokens(fresh(FULL));
  resetNet();
  routes.push({
    match: (u) => u.includes("/calendar/v3/"),
    reply: () => ({
      status: 403,
      json: {
        error: {
          code: 403,
          message: "Request had insufficient authentication scopes.",
          errors: [{ reason: "insufficientPermissions" }],
          status: "PERMISSION_DENIED",
          details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }],
        },
      },
    }),
  });
  const r = await handlers["calendar-create-event"](null, { title: "x", start: "2026-10-20T10:00:00Z" });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.needsReconnect, true);

  resetNet();
  routes.push({
    match: (u) => u.includes("/calendar/v3/"),
    reply: () => ({
      status: 403,
      json: { error: { message: "Google Calendar API has not been used in project 123 before or it is disabled.", errors: [{ reason: "accessNotConfigured" }] } },
    }),
  });
  const r2 = await handlers["calendar-create-event"](null, { title: "x", start: "2026-10-20T10:00:00Z" });
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.needsReconnect, undefined);
  assert.match(r2.error, /has not been used/);
});

test("create-event: 401 → one forced refresh + retry", async () => {
  writeTokens(fresh(FULL));
  resetNet();
  let n = 0;
  routes.push({ match: (u) => u.startsWith("https://oauth2.googleapis.com/token"), reply: () => ({ json: { access_token: "AT2", expires_in: 3600 } }) });
  routes.push({
    match: (u) => u.includes("/calendar/v3/"),
    reply: () => (++n === 1 ? { status: 401, json: { error: { message: "Invalid Credentials" } } } : { json: { id: "ev3", htmlLink: "L" } }),
  });
  const r = await handlers["calendar-create-event"](null, { title: "x", start: "2026-10-20T10:00:00Z" });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(calls[2].init.headers.Authorization, "Bearer AT2");
});

test("refresh invalid_grant → tokens wiped, google-auth-expired sent, needsReconnect", async () => {
  writeTokens({ ...fresh(FULL), expiry_date: 0 });
  resetNet();
  sent.length = 0;
  routes.push({ match: (u) => u.startsWith("https://oauth2.googleapis.com/token"), reply: () => ({ status: 400, json: { error: "invalid_grant" } }) });
  const r = await handlers["calendar-create-event"](null, { title: "x", start: "2026-10-20T10:00:00Z" });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.needsReconnect, true);
  assert.strictEqual(fs.existsSync(tokenPath), false);
  assert.deepStrictEqual(sent.map((s) => s[0]), ["google-auth-expired"]);
  assert.strictEqual((await handlers["calendar-status"]()).connected, false);
});

// ---------------- gmail ----------------
test("From header → display name", () => {
  assert.strictEqual(senderName("Riya Shah <riya@x.com>"), "Riya Shah");
  assert.strictEqual(senderName("<a@b.com>"), "a");
  assert.strictEqual(senderName("a@b.com"), "a");
  assert.strictEqual(senderName('"Shah, Riya" <riya@x.com>'), "Shah, Riya");
  assert.strictEqual(senderName("riya@x.com (Riya Shah)"), "Riya Shah");
  assert.strictEqual(senderName("'riya@x.com' <riya@x.com>"), "riya");
  assert.strictEqual(senderName(""), "");
});

test("subject trimmed to 120 chars", () => {
  assert.strictEqual(cleanSubject("  hi \n there  "), "hi there");
  const long = cleanSubject("x".repeat(300));
  assert.strictEqual(long.length, 120);
  assert.ok(long.endsWith("…"));
});

function gmailRoutes(state) {
  routes.push({
    match: (u) => u.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/messages?"),
    reply: (u) => {
      const q = new URL(u).searchParams;
      assert.deepStrictEqual(q.getAll("labelIds"), ["INBOX", "UNREAD", "CATEGORY_PERSONAL"]);
      assert.strictEqual(q.get("maxResults"), "15");
      assert.strictEqual(q.has("q"), false); // not allowed with gmail.metadata
      return { json: state.ids.length ? { messages: state.ids.map((id) => ({ id, threadId: id })) } : {} };
    },
  });
  routes.push({
    match: (u) => /gmail\/v1\/users\/me\/messages\/[^?]+\?/.test(u),
    reply: (u) => {
      const url = new URL(u);
      const id = decodeURIComponent(url.pathname.split("/").pop());
      assert.strictEqual(url.searchParams.get("format"), "metadata");
      assert.deepStrictEqual(url.searchParams.getAll("metadataHeaders"), ["From", "Subject"]);
      const m = state.meta[id];
      if (!m) return { status: 404, json: {} };
      return { json: { id, payload: { headers: [{ name: "From", value: m.from }, { name: "subject", value: m.subject }] } } };
    },
  });
}

test("gmail: first poll silent, then alert on new id; batch when >3; hidden → no fetch", async () => {
  resetNet();
  sent.length = 0;
  visible = true;
  const state = { ids: ["m3", "m2", "m1"], meta: {} };
  gmailRoutes(state);
  const w = createGmailWatcher({ getAccessToken: async () => "AT", getWindow: () => fakeWin, firstDelayMs: 1e9 });
  await w.pollOnce(); // not started → no-op
  assert.strictEqual(calls.length, 0);
  w.start();

  await w.pollOnce(); // baseline
  assert.strictEqual(sent.length, 0);
  assert.strictEqual(calls.length, 1);

  await w.pollOnce(); // nothing new
  assert.strictEqual(sent.length, 0);

  state.ids = ["m4", "m3", "m2", "m1"];
  state.meta.m4 = { from: "Riya Shah <riya@x.com>", subject: "  dinner tonight?? " };
  await w.pollOnce();
  assert.deepStrictEqual(sent, [["gmail-new", { id: "m4", from: "Riya Shah", subject: "dinner tonight??" }]]);
  assert.ok(calls.at(-1).init.headers.Authorization === "Bearer AT");

  await w.pollOnce(); // m4 already seen
  assert.strictEqual(sent.length, 1);

  // two new → two alerts, oldest first
  state.ids = ["m6", "m5", "m4"];
  state.meta.m5 = { from: "<a@b.com>", subject: "first" };
  state.meta.m6 = { from: "c@d.com", subject: "second" };
  await w.pollOnce();
  assert.deepStrictEqual(sent.slice(1).map((s) => s[1].id), ["m5", "m6"]);
  assert.strictEqual(sent[1][1].from, "a");

  // >3 new at once → one batch, no per-message fetches
  sent.length = 0;
  const before = calls.length;
  state.ids = ["n4", "n3", "n2", "n1", "m6"];
  await w.pollOnce();
  assert.deepStrictEqual(sent, [["gmail-new", { id: "batch", from: "", subject: "", count: 4 }]]);
  assert.strictEqual(calls.length - before, 1);

  // hidden window → skip entirely
  visible = false;
  state.ids = ["z1"];
  const before2 = calls.length;
  await w.pollOnce();
  assert.strictEqual(calls.length, before2);
  visible = true;

  // stop → wiped; restart → silent baseline again
  w.stop();
  assert.strictEqual(w._seenCount(), 0);
  sent.length = 0;
  w.start();
  await w.pollOnce();
  assert.strictEqual(sent.length, 0);
  w.stop();
});

test("gmail: 404 on detail = forget silently; network error = retry next poll", async () => {
  resetNet();
  sent.length = 0;
  const state = { ids: [], meta: {} };
  gmailRoutes(state);
  let failOnce = true;
  routes.unshift({
    match: (u) => u.includes("/messages/r1?") && failOnce,
    reply: () => {
      failOnce = false;
      return { status: 500, json: {} };
    },
  });
  const w = createGmailWatcher({ getAccessToken: async () => "AT", getWindow: () => fakeWin, firstDelayMs: 1e9 });
  w.start();
  await w.pollOnce();
  state.ids = ["r1", "gone"];
  state.meta.r1 = { from: "R <r@x.com>", subject: "s" };
  await w.pollOnce(); // gone → 404 (forgotten), r1 → 500 (retry)
  assert.strictEqual(sent.length, 0);
  await w.pollOnce(); // r1 retried
  assert.deepStrictEqual(sent.map((s) => s[1].id), ["r1"]);
  w.stop();
});

test("seen set capped", async () => {
  resetNet();
  sent.length = 0;
  const state = { ids: [], meta: {} };
  gmailRoutes(state);
  const w = createGmailWatcher({ getAccessToken: async () => "AT", getWindow: () => fakeWin, firstDelayMs: 1e9 });
  w.start();
  await w.pollOnce();
  for (let i = 0; i < 60; i++) {
    state.ids = Array.from({ length: 15 }, (_, k) => `c${i}-${k}`);
    await w.pollOnce(); // 15 new each → batch, no detail fetches
  }
  assert.ok(w._seenCount() <= 500, "seen " + w._seenCount());
  w.stop();
});

test("disabled Gmail stays off + disconnect wiring", async () => {
  const g = cal._internals.gmail;
  writeTokens(fresh(FULL));
  let r = await handlers["gmail-set-enabled"](null, true);
  assert.deepStrictEqual(r, { ok: true, enabled: true, active: false });
  cal.stopPolling(); // what main.cjs data-reset calls
  assert.strictEqual(g.isRunning(), false);
  r = await handlers["gmail-set-enabled"](null, { enabled: true });
  assert.strictEqual(r.active, false);
  r = await handlers["gmail-set-enabled"](null, false);
  assert.deepStrictEqual(r, { ok: true, enabled: false, active: false });
  // enabled but no gmail scope (legacy grant) → stays off
  writeTokens({ access_token: "AT", refresh_token: "RT", expiry_date: Date.now() + 3600_000 });
  r = await handlers["gmail-set-enabled"](null, true);
  assert.deepStrictEqual(r, { ok: true, enabled: true, active: false });
  // disconnect stops it and wipes tokens
  writeTokens(fresh(FULL));
  await handlers["gmail-set-enabled"](null, true);
  assert.strictEqual(g.isRunning(), false);
  await handlers["calendar-disconnect"]();
  assert.strictEqual(g.isRunning(), false);
  assert.strictEqual(fs.existsSync(tokenPath), false);
  assert.deepStrictEqual((await handlers["calendar-status"]()).connected, false);
});

test("IPC channel list", () => {
  assert.deepStrictEqual(Object.keys(handlers).sort(), [
    "calendar-clear-all", "calendar-connect", "calendar-create-event", "calendar-disconnect",
    "calendar-save-client", "calendar-status", "gmail-set-enabled",
  ]);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log("ok   " + name);
    } catch (e) {
      failed++;
      console.log("FAIL " + name + "\n     " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n     ") : e));
    }
  }
  cal.stopPolling();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failed ? `\n${failed} failed` : `\nall ${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
