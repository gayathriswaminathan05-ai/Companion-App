// Unit tests for the Companion proxy. Run from proxy/: `npm test`
// (or `node --test test/worker.test.mjs`). No network, no Cloudflare account:
// the Worker is called directly with a fake env, a Map-backed fake KV, and a
// stubbed global fetch standing in for api.anthropic.com.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../worker.js";

const DEVICE = "3f1c2b9a-6d4e-4f7a-9b2c-1e5d8a7c6b40";
const APP_TOKEN = "test-app-token-0123456789";
const SECRET_KEY = "sk-ant-test-SECRET";
const BASE = "https://companion-proxy.example.workers.dev";
const today = () => new Date().toISOString().slice(0, 10);
const counterKey = (device = DEVICE) => `d:${device}:${today()}`;

// ---------- fakes ----------

function fakeKV() {
  const map = new Map();
  const puts = [];
  return {
    map,
    puts,
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value, opts) {
      map.set(key, String(value));
      puts.push({ key, value: String(value), opts });
    },
  };
}

function fakeEnv(overrides = {}) {
  return {
    ANTHROPIC_API_KEY: SECRET_KEY,
    APP_TOKEN,
    ALLOWED_MODELS: "claude-sonnet-5,claude-haiku-5-5",
    MAX_TOKENS_CAP: "2048",
    DAILY_LIMIT: "60",
    RATE: fakeKV(),
    ...overrides,
  };
}

function fakeCtx() {
  const pending = [];
  return {
    waitUntil(p) {
      pending.push(p);
    },
    async flush() {
      await Promise.all(pending.splice(0));
    },
  };
}

// Stub for api.anthropic.com: records calls, replies from a queue (or a default).
const realFetch = globalThis.fetch;
let upstreamCalls;
let upstreamQueue;
let upstreamDefault;

beforeEach(() => {
  upstreamCalls = [];
  upstreamQueue = [];
  upstreamDefault = () => jsonUpstream(200, okMessage());
  globalThis.fetch = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    upstreamCalls.push({ url: String(url), method: init.method, headers, body: init.body });
    const next = upstreamQueue.shift() || upstreamDefault;
    return next();
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function okMessage(stop_reason = "end_turn") {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content: [{ type: "text", text: "Hi bestie!" }],
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 4 },
  };
}

function jsonUpstream(status, obj, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "request-id": "req_upstream_1", ...extra },
  });
}

function sseText(text, stop_reason = "end_turn") {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  return (
    ev("message_start", {
      message: {
        id: "msg_sse",
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5",
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 1 },
      },
    }) +
    ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }) +
    ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: text.slice(0, 3) } }) +
    ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: text.slice(3) } }) +
    ev("content_block_stop", { index: 0 }) +
    ev("message_delta", { delta: { stop_reason, stop_sequence: null }, usage: { output_tokens: 5 } }) +
    ev("message_stop", {})
  );
}

// Upstream SSE response delivered in awkward chunk sizes.
function sseUpstream(text, stop_reason) {
  const bytes = new TextEncoder().encode(sseText(text, stop_reason));
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 37) controller.enqueue(bytes.slice(i, i + 37));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", "request-id": "req_sse" },
  });
}

// ---------- helpers ----------

const userTurn = (text = "hello") => ({
  model: "claude-sonnet-5",
  max_tokens: 1024,
  system: [{ type: "text", text: "You are Blob.", cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: text }],
  tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
});

const continuation = () => ({
  ...userTurn(),
  messages: [
    { role: "user", content: "research cozy cafes" },
    { role: "assistant", content: [{ type: "text", text: "Searching..." }] },
  ],
});

function call(body, { env, ctx, headers = {}, method = "POST", path = "/v1/messages" } = {}) {
  const h = {
    "content-type": "application/json",
    "x-api-key": "unused",
    authorization: "Bearer should-not-leak",
    "anthropic-version": "2023-06-01",
    "x-companion-app": APP_TOKEN,
    "x-companion-device": DEVICE,
    ...headers,
  };
  for (const k of Object.keys(h)) if (h[k] === undefined) delete h[k];
  const init = { method, headers: h };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  return worker.fetch(new Request(BASE + path, init), env, ctx);
}

async function errorBody(res) {
  const json = await res.json();
  assert.equal(json.type, "error");
  return json.error;
}

// ---------- tests ----------

test("GET /health returns ok", async () => {
  const res = await call(undefined, { env: fakeEnv(), method: "GET", path: "/health" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("unknown path is 404 and wrong method is 405", async () => {
  const env = fakeEnv();
  assert.equal((await call(userTurn(), { env, path: "/v1/complete" })).status, 404);
  assert.equal((await call(undefined, { env, method: "GET" })).status, 405);
  assert.equal(upstreamCalls.length, 0);
});

test("missing secrets -> 500 proxy_not_configured, nothing forwarded", async () => {
  const res = await call(userTurn(), { env: fakeEnv({ ANTHROPIC_API_KEY: undefined }) });
  assert.equal(res.status, 500);
  assert.equal((await errorBody(res)).message, "proxy_not_configured");
  assert.equal(upstreamCalls.length, 0);
});

test("auth: missing or wrong app token -> 401", async () => {
  const env = fakeEnv();
  for (const token of [undefined, "", "wrong-token", APP_TOKEN + "x"]) {
    const res = await call(userTurn(), { env, headers: { "x-companion-app": token } });
    assert.equal(res.status, 401, `token ${token}`);
    assert.equal(res.headers.get("x-should-retry"), "false");
    assert.deepEqual(await errorBody(res), { type: "authentication_error", message: "bad_app_token" });
  }
  assert.equal(upstreamCalls.length, 0);
});

test("bad device id -> 400", async () => {
  const env = fakeEnv();
  for (const device of [undefined, "", "abc", "3f1c2b9a6d4e4f7a9b2c1e5d8a7c6b40", DEVICE + "0", "../../etc"]) {
    const res = await call(userTurn(), { env, headers: { "x-companion-device": device } });
    assert.equal(res.status, 400, `device ${device}`);
    assert.deepEqual(await errorBody(res), { type: "invalid_request_error", message: "bad_device_id" });
  }
  assert.equal(upstreamCalls.length, 0);
});

test("uppercase device UUID is accepted and normalized in the counter key", async () => {
  const env = fakeEnv();
  const ctx = fakeCtx();
  const res = await call(userTurn(), { env, ctx, headers: { "x-companion-device": DEVICE.toUpperCase() } });
  assert.equal(res.status, 200);
  await ctx.flush();
  assert.equal(env.RATE.map.get(counterKey()), "1");
});

test("invalid JSON body -> 400", async () => {
  const res = await call("{not json", { env: fakeEnv() });
  assert.equal(res.status, 400);
  assert.equal((await errorBody(res)).message, "invalid_json");
});

test("model not on allow-list -> 400", async () => {
  const env = fakeEnv();
  for (const model of ["claude-opus-5-5", "claude-fable-5-1", undefined, 42]) {
    const res = await call({ ...userTurn(), model }, { env });
    assert.equal(res.status, 400, `model ${model}`);
    assert.deepEqual(await errorBody(res), { type: "invalid_request_error", message: "model_not_allowed" });
  }
  assert.equal(upstreamCalls.length, 0);
  // Allowed models go through.
  assert.equal((await call({ ...userTurn(), model: "claude-haiku-5-5" }, { env })).status, 200);
});

test("forwarding: secret key added, client credentials and companion headers stripped", async () => {
  const res = await call(userTurn(), {
    env: fakeEnv(),
    headers: { "anthropic-beta": "some-beta-2026-01-01", accept: "application/json" },
  });
  assert.equal(res.status, 200);
  assert.equal(upstreamCalls.length, 1);
  const up = upstreamCalls[0];
  assert.equal(up.url, "https://api.anthropic.com/v1/messages");
  assert.equal(up.method, "POST");
  assert.equal(up.headers.get("x-api-key"), SECRET_KEY);
  assert.equal(up.headers.get("anthropic-version"), "2023-06-01");
  assert.equal(up.headers.get("anthropic-beta"), "some-beta-2026-01-01");
  assert.equal(up.headers.get("content-type"), "application/json");
  assert.equal(up.headers.get("authorization"), null);
  assert.equal(up.headers.get("x-companion-app"), null);
  assert.equal(up.headers.get("x-companion-device"), null);
  // Body passes through unchanged when no clamping is needed.
  assert.deepEqual(JSON.parse(up.body), userTurn());
});

test("max_tokens above the cap is clamped; everything else untouched", async () => {
  const env = fakeEnv();
  await call({ ...userTurn(), max_tokens: 64000 }, { env });
  const sent = JSON.parse(upstreamCalls[0].body);
  assert.equal(sent.max_tokens, 2048);
  assert.deepEqual({ ...sent, max_tokens: 1024 }, userTurn());

  await call({ ...userTurn(), max_tokens: 300 }, { env });
  assert.equal(JSON.parse(upstreamCalls[1].body).max_tokens, 300);

  await call({ ...userTurn(), max_tokens: 5000 }, { env: fakeEnv({ MAX_TOKENS_CAP: "4096" }) });
  assert.equal(JSON.parse(upstreamCalls[2].body).max_tokens, 4096);
});

test("daily limit: user turns count, assistant-ending continuations do not", async () => {
  const env = fakeEnv({ DAILY_LIMIT: "2" });
  const ctx = fakeCtx();
  const count = async () => {
    await ctx.flush();
    return env.RATE.map.get(counterKey()) ?? null;
  };

  assert.equal((await call(userTurn(), { env, ctx })).status, 200);
  assert.equal(await count(), "1");

  assert.equal((await call(continuation(), { env, ctx })).status, 200);
  assert.equal(await count(), "1", "pause_turn continuation must not count");

  assert.equal((await call(userTurn(), { env, ctx })).status, 200);
  assert.equal(await count(), "2");

  const callsBefore = upstreamCalls.length;
  const blocked = await call(userTurn(), { env, ctx });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("x-should-retry"), "false");
  assert.deepEqual(await blocked.json(), {
    type: "error",
    error: { type: "rate_limit_error", message: "daily_limit" },
  });
  assert.equal(upstreamCalls.length, callsBefore, "blocked turn must not reach Anthropic");
  assert.equal(await count(), "2");

  // A continuation of an answer already in progress still finishes.
  assert.equal((await call(continuation(), { env, ctx })).status, 200);

  // Counter key format + TTL; only numbers are ever stored.
  for (const p of env.RATE.puts) {
    assert.match(p.key, /^d:[0-9a-f-]{36}:\d{4}-\d{2}-\d{2}$/);
    assert.match(p.value, /^\d+$/);
    assert.ok(p.opts.expirationTtl >= 86400 * 2 && p.opts.expirationTtl <= 86400 * 3);
  }
});

test("daily limit is per device", async () => {
  const env = fakeEnv({ DAILY_LIMIT: "1" });
  const ctx = fakeCtx();
  const other = "11111111-2222-4333-8444-555555555555";
  assert.equal((await call(userTurn(), { env, ctx })).status, 200);
  await ctx.flush();
  assert.equal((await call(userTurn(), { env, ctx })).status, 429);
  assert.equal((await call(userTurn(), { env, ctx, headers: { "x-companion-device": other } })).status, 200);
});

test("DAILY_LIMIT=0 pauses chat for everyone", async () => {
  const res = await call(userTurn(), { env: fakeEnv({ DAILY_LIMIT: "0" }) });
  assert.equal(res.status, 429);
  assert.equal(upstreamCalls.length, 0);
});

test("failed upstream requests do not use up the daily allowance", async () => {
  const env = fakeEnv();
  const ctx = fakeCtx();
  upstreamQueue.push(() =>
    jsonUpstream(529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }),
  );
  const res = await call(userTurn(), { env, ctx });
  assert.equal(res.status, 529);
  await ctx.flush();
  assert.equal(env.RATE.map.get(counterKey()), undefined);
});

test("streaming: SSE body, status and content-type pass through unchanged", async () => {
  upstreamQueue.push(() => sseUpstream("Hello friend!"));
  const res = await call({ ...userTurn(), stream: true }, { env: fakeEnv() });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.equal(res.headers.get("request-id"), "req_sse");
  assert.equal(await res.text(), sseText("Hello friend!"));
  assert.equal(JSON.parse(upstreamCalls[0].body).stream, true);
});

test("upstream error passes through (status, body, content-type, request-id)", async () => {
  const errBody = { type: "error", error: { type: "invalid_request_error", message: "messages: bad" } };
  upstreamQueue.push(() => jsonUpstream(400, errBody, { "anthropic-organization-id": "org-secret" }));
  const res = await call(userTurn(), { env: fakeEnv() });
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("content-type"), "application/json");
  assert.equal(res.headers.get("request-id"), "req_upstream_1");
  assert.equal(res.headers.get("anthropic-organization-id"), null, "org id is not leaked");
  assert.deepEqual(await res.json(), errBody);

  upstreamQueue.push(() =>
    jsonUpstream(429, { type: "error", error: { type: "rate_limit_error", message: "slow down" } }, { "retry-after": "7" }),
  );
  const rl = await call(userTurn(), { env: fakeEnv() });
  assert.equal(rl.status, 429);
  assert.equal(rl.headers.get("retry-after"), "7");
});

test("upstream unreachable -> 502 api_error (retryable)", async () => {
  upstreamQueue.push(() => {
    throw new TypeError("network down");
  });
  const res = await call(userTurn(), { env: fakeEnv() });
  assert.equal(res.status, 502);
  assert.equal(res.headers.get("x-should-retry"), "true");
  assert.deepEqual(await errorBody(res), { type: "api_error", message: "upstream_unreachable" });
});

test("privacy: worker source never logs", async () => {
  const src = await readFile(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(!/console\.\w+\s*\(/.test(src), "worker.js must not call console.*()");
});

// ---------- end-to-end through the real Anthropic SDK (the app's code path) ----------

let Anthropic = null;
try {
  Anthropic = (await import("@anthropic-ai/sdk")).default;
} catch {
  // SDK not installed next to the repo: skip these.
}

function sdkClient(env, ctx, seen) {
  return new Anthropic({
    apiKey: "unused",
    baseURL: BASE,
    defaultHeaders: { "x-companion-device": DEVICE, "x-companion-app": APP_TOKEN },
    maxRetries: 2,
    fetch: async (url, init) => {
      seen.push(String(url));
      return worker.fetch(new Request(url, init), env, ctx);
    },
  });
}

test("SDK: streaming chat with pause_turn loop counts as ONE turn", { skip: !Anthropic }, async () => {
  const env = fakeEnv();
  const ctx = fakeCtx();
  const seen = [];
  const client = sdkClient(env, ctx, seen);
  upstreamQueue.push(() => sseUpstream("Let me look...", "pause_turn"));
  upstreamQueue.push(() => sseUpstream("Found it!", "end_turn"));

  // Same loop shape as electron/main.cjs "chat-send".
  let msgs = [{ role: "user", content: "find me a cafe" }];
  let full = "";
  for (let hop = 0; hop < 4; hop++) {
    const stream = client.messages.stream({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system: [{ type: "text", text: "You are Blob.", cache_control: { type: "ephemeral" } }],
      messages: msgs,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
    });
    stream.on("text", (t) => (full += t));
    const final = await stream.finalMessage();
    if (final.stop_reason === "pause_turn") {
      msgs = [...msgs, { role: "assistant", content: final.content }];
      continue;
    }
    break;
  }
  assert.equal(full, "Let me look...Found it!");
  assert.equal(upstreamCalls.length, 2);
  assert.equal(upstreamCalls[0].headers.get("x-api-key"), SECRET_KEY);
  assert.ok(seen.every((u) => u.startsWith(BASE + "/v1/messages")));
  await ctx.flush();
  assert.equal(env.RATE.map.get(counterKey()), "1");
});

test("SDK: daily limit surfaces as RateLimitError, no retries", { skip: !Anthropic }, async () => {
  const env = fakeEnv({ DAILY_LIMIT: "0" });
  const seen = [];
  const client = sdkClient(env, fakeCtx(), seen);
  await assert.rejects(
    client.messages.create({ model: "claude-sonnet-5", max_tokens: 300, messages: [{ role: "user", content: "joke pls" }] }),
    (err) => {
      assert.ok(err instanceof Anthropic.RateLimitError);
      assert.equal(err.status, 429);
      assert.equal(err.error?.error?.message, "daily_limit");
      assert.ok(err.message.includes("daily_limit"));
      console.log("    SDK err.message for daily limit:", err.message);
      return true;
    },
  );
  assert.equal(seen.length, 1, "SDK must not retry the daily-limit 429");
  assert.equal(upstreamCalls.length, 0);
});

test("SDK: bad app token surfaces as AuthenticationError", { skip: !Anthropic }, async () => {
  const env = fakeEnv({ APP_TOKEN: "a-different-token" });
  const seen = [];
  const client = sdkClient(env, fakeCtx(), seen);
  await assert.rejects(
    client.messages.create({ model: "claude-sonnet-5", max_tokens: 300, messages: [{ role: "user", content: "hi" }] }),
    (err) => err instanceof Anthropic.AuthenticationError && err.status === 401,
  );
  assert.equal(seen.length, 1);
});

// ---------------------------------------------------------------------------
// /v1/tts — Blob's cloud voice (Google Text-to-Speech)
// ---------------------------------------------------------------------------

const ttsEnv = (o = {}) => fakeEnv({ GOOGLE_TTS_KEY: "g-test-KEY", TTS_DAILY_CHARS: "100", ...o });
const ttsReq = (body, headers = {}) =>
  new Request(`${BASE}/v1/tts`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-companion-app": APP_TOKEN, "x-companion-device": DEVICE, ...headers },
    body: JSON.stringify(body),
  });
const goodTts = { text: "hey! time to call amma.", languageCode: "en-IN", voiceName: "en-IN-Chirp3-HD-Puck" };

test("tts: forwards to Google with the server key and returns audio", async () => {
  upstreamQueue.push(() => jsonUpstream(200, { audioContent: "UklGRgAAAA==" }));
  const env = ttsEnv();
  const ctx = fakeCtx();
  const res = await worker.fetch(ttsReq({ ...goodTts, speakingRate: 5 }), env, ctx);
  await ctx.flush();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { audioContent: "UklGRgAAAA==" });
  const call = upstreamCalls[0];
  assert.match(call.url, /texttospeech\.googleapis\.com/);
  assert.equal(call.headers.get("x-goog-api-key"), "g-test-KEY");
  const sent = JSON.parse(call.body);
  assert.equal(sent.voice.name, "en-IN-Chirp3-HD-Puck");
  assert.equal(sent.audioConfig.speakingRate, 1.3); // clamped
  assert.equal(env.RATE.map.get(`t:${DEVICE}:${today()}`), String(goodTts.text.length));
});

test("tts: guards (token, device, locale, voice, length)", async () => {
  const env = ttsEnv();
  assert.equal((await worker.fetch(ttsReq(goodTts, { "x-companion-app": "nope" }), env)).status, 401);
  assert.equal((await worker.fetch(ttsReq(goodTts, { "x-companion-device": "x" }), env)).status, 400);
  assert.equal((await worker.fetch(ttsReq({ ...goodTts, languageCode: "fr-FR" }), env)).status, 400);
  assert.equal((await worker.fetch(ttsReq({ ...goodTts, voiceName: "en-US-Chirp3-HD-Puck" }), env)).status, 400);
  assert.equal((await worker.fetch(ttsReq({ ...goodTts, text: "a".repeat(601) }), env)).status, 400);
  assert.equal(upstreamCalls.length, 0);
});

test("tts: daily character budget blocks with 429 and failed calls are free", async () => {
  const env = ttsEnv({ TTS_DAILY_CHARS: "30" });
  upstreamQueue.push(() => jsonUpstream(500, { error: "boom" }));
  assert.equal((await worker.fetch(ttsReq(goodTts), env)).status, 502);
  assert.equal(env.RATE.map.get(`t:${DEVICE}:${today()}`), undefined);
  upstreamQueue.push(() => jsonUpstream(200, { audioContent: "AAAA" }));
  assert.equal((await worker.fetch(ttsReq(goodTts), env)).status, 200);
  const blocked = await worker.fetch(ttsReq(goodTts), env);
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error.message, "tts_daily_limit");
});

test("tts: not configured without the Google key", async () => {
  const res = await worker.fetch(ttsReq(goodTts), fakeEnv());
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error.message, "tts_not_configured");
});

// ---------------------------------------------------------------------------
// /v1/responses — ChatGPT (OpenAI Responses API)
// ---------------------------------------------------------------------------

const OPENAI_SECRET = "sk-proj-test-OPENAI-SECRET";
const oaEnv = (o = {}) => fakeEnv({ OPENAI_API_KEY: OPENAI_SECRET, ...o });
const oaTurn = (text = "hello") => ({
  model: "gpt-6.1-sol",
  instructions: "You are Blob.",
  input: [{ role: "user", content: text }],
  tools: [{ type: "web_search", user_location: { type: "approximate", country: "IN" } }],
  reasoning: { effort: "low" },
  max_output_tokens: 4096,
  store: false,
});
const oaCall = (body, opts = {}) => call(body, { ...opts, path: "/v1/responses" });

test("openai: forwards to OpenAI with the server key; client credentials stripped; store forced off", async () => {
  const env = oaEnv();
  const ctx = fakeCtx();
  const res = await oaCall({ ...oaTurn(), store: true, max_output_tokens: 99999 }, { env, ctx });
  assert.equal(res.status, 200);
  assert.equal(upstreamCalls.length, 1);
  const up = upstreamCalls[0];
  assert.equal(up.url, "https://api.openai.com/v1/responses");
  assert.equal(up.headers.get("authorization"), `Bearer ${OPENAI_SECRET}`);
  assert.equal(up.headers.get("x-api-key"), null);
  assert.equal(up.headers.get("x-companion-app"), null);
  assert.equal(up.headers.get("x-companion-device"), null);
  const sent = JSON.parse(up.body);
  assert.equal(sent.store, false);
  assert.equal(sent.max_output_tokens, 4096);
  assert.equal(sent.instructions, "You are Blob.");
  await ctx.flush();
  assert.equal(env.RATE.map.get(counterKey()), "1");
});

test("openai: guards (secret, model, tools, stored state)", async () => {
  // Only the Claude key configured: the ChatGPT route is not set up.
  let res = await oaCall(oaTurn(), { env: fakeEnv() });
  assert.equal(res.status, 500);
  assert.equal((await errorBody(res)).message, "proxy_not_configured");

  res = await oaCall({ ...oaTurn(), model: "gpt-6-astra" }, { env: oaEnv() });
  assert.equal(res.status, 400);
  assert.equal((await errorBody(res)).message, "model_not_allowed");

  res = await oaCall({ ...oaTurn(), tools: [{ type: "code_interpreter", container: { type: "auto" } }] }, { env: oaEnv() });
  assert.equal(res.status, 400);
  assert.equal((await errorBody(res)).message, "tool_not_allowed");

  for (const extra of [{ previous_response_id: "resp_1" }, { conversation: "conv_1" }, { background: true }]) {
    res = await oaCall({ ...oaTurn(), ...extra }, { env: oaEnv() });
    assert.equal(res.status, 400);
    assert.equal((await errorBody(res)).message, "stored_state_not_allowed");
  }
  res = await oaCall(oaTurn(), { env: oaEnv(), headers: { "x-companion-app": "nope" } });
  assert.equal(res.status, 401);
  assert.equal(upstreamCalls.length, 0);
});

test("openai: daily limit is shared with Claude and failed calls are free", async () => {
  const env = oaEnv({ DAILY_LIMIT: "2" });
  const ctx = fakeCtx();
  upstreamQueue.push(() => jsonUpstream(500, { error: { message: "boom", type: "server_error" } }));
  assert.equal((await oaCall(oaTurn(), { env, ctx })).status, 500);
  await ctx.flush();
  assert.equal(env.RATE.map.get(counterKey()), undefined);
  assert.equal((await oaCall(oaTurn(), { env, ctx })).status, 200);
  assert.equal((await call(userTurn(), { env, ctx })).status, 200); // a Claude turn counts too
  await ctx.flush();
  const res = await oaCall(oaTurn(), { env, ctx });
  assert.equal(res.status, 429);
  assert.equal((await errorBody(res)).message, "daily_limit");
});

// ---------- end-to-end through the real OpenAI SDK (the app's ChatGPT path) ----------

let OpenAI = null;
try {
  OpenAI = (await import("openai")).default;
} catch {
  // SDK not installed next to the repo: skip these.
}

function responsesSse(pieces, citation) {
  let seq = 0;
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, sequence_number: seq++, ...data })}\n\n`;
  const base = { id: "resp_1", object: "response", created_at: 1, model: "gpt-6.1-sol", output: [], usage: null };
  const text = pieces.join("");
  const ann = citation ? [{ type: "url_citation", url: citation.url, title: citation.title, start_index: 0, end_index: 3 }] : [];
  const msg = (status, content) => ({ id: "msg_1", type: "message", status, role: "assistant", content });
  let out =
    ev("response.created", { response: { ...base, status: "in_progress" } }) +
    ev("response.output_item.added", { output_index: 0, item: { id: "ws_1", type: "web_search_call", status: "in_progress" } }) +
    ev("response.output_item.done", { output_index: 0, item: { id: "ws_1", type: "web_search_call", status: "completed", action: { type: "search", query: "cafes" } } }) +
    ev("response.output_item.added", { output_index: 1, item: msg("in_progress", []) }) +
    ev("response.content_part.added", { item_id: "msg_1", output_index: 1, content_index: 0, part: { type: "output_text", text: "", annotations: [] } });
  for (const p of pieces) {
    out += ev("response.output_text.delta", { item_id: "msg_1", output_index: 1, content_index: 0, delta: p, logprobs: [] });
  }
  if (citation) {
    out += ev("response.output_text.annotation.added", { item_id: "msg_1", output_index: 1, content_index: 0, annotation_index: 0, annotation: ann[0] });
  }
  const part = { type: "output_text", text, annotations: ann };
  out +=
    ev("response.output_text.done", { item_id: "msg_1", output_index: 1, content_index: 0, text, logprobs: [] }) +
    ev("response.content_part.done", { item_id: "msg_1", output_index: 1, content_index: 0, part }) +
    ev("response.output_item.done", { output_index: 1, item: msg("completed", [part]) }) +
    ev("response.completed", {
      response: {
        ...base,
        status: "completed",
        output: [{ id: "ws_1", type: "web_search_call", status: "completed", action: { type: "search", query: "cafes" } }, msg("completed", [part])],
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      },
    });
  const bytes = new TextEncoder().encode(out);
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 41) controller.enqueue(bytes.slice(i, i + 41));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream; charset=utf-8", "x-request-id": "req_oa" } });
}

function openaiClient(env, ctx, seen) {
  return new OpenAI({
    apiKey: "unused",
    baseURL: `${BASE}/v1`,
    defaultHeaders: { "x-companion-device": DEVICE, "x-companion-app": APP_TOKEN },
    maxRetries: 2,
    fetch: async (url, init) => {
      seen.push(String(url));
      return worker.fetch(new Request(url, init), env, ctx);
    },
  });
}

test("SDK openai: streaming chat with web search, text + sources (main.cjs chatOpenAI shape)", { skip: !OpenAI }, async () => {
  const env = oaEnv();
  const ctx = fakeCtx();
  const seen = [];
  const client = openaiClient(env, ctx, seen);
  upstreamQueue.push(() => responsesSse(["ok I went ", "FULL detective mode"], { url: "https://cafes.example", title: "Cafes" }));

  const stream = client.responses.stream({ ...oaTurn("find me a cafe"), prompt_cache_key: "companion-chat" });
  let full = "";
  stream.on("response.output_text.delta", (ev) => (full += ev.delta));
  const final = await stream.finalResponse();
  const sources = [];
  for (const item of final.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      for (const a of part.annotations || []) if (a.type === "url_citation") sources.push({ url: a.url, title: a.title });
    }
  }
  assert.equal(full, "ok I went FULL detective mode");
  assert.deepEqual(sources, [{ url: "https://cafes.example", title: "Cafes" }]);
  assert.ok(seen.every((u) => u.startsWith(BASE + "/v1/responses")));
  assert.equal(upstreamCalls.length, 1);
  assert.equal(JSON.parse(upstreamCalls[0].body).store, false);
  await ctx.flush();
  assert.equal(env.RATE.map.get(counterKey()), "1");
});

test("SDK openai: daily limit surfaces with 'daily_limit' in the message, no retries", { skip: !OpenAI }, async () => {
  const env = oaEnv({ DAILY_LIMIT: "0" });
  const seen = [];
  const client = openaiClient(env, fakeCtx(), seen);
  await assert.rejects(client.responses.create(oaTurn()), (err) => {
    assert.ok(err instanceof OpenAI.RateLimitError);
    assert.ok(err.message.includes("daily_limit"), err.message);
    return true;
  });
  assert.equal(seen.length, 1, "SDK must not retry the daily-limit 429");
});

test("SDK openai: out-of-credit error reaches the app with OpenAI's wording", { skip: !OpenAI }, async () => {
  const env = oaEnv();
  const client = openaiClient(env, fakeCtx(), []);
  upstreamDefault = () =>
    jsonUpstream(429, {
      error: {
        message: "You exceeded your current quota, please check your plan and billing details.",
        type: "insufficient_quota",
        code: "insufficient_quota",
      },
    }, { "x-should-retry": "false" });
  await assert.rejects(client.responses.create(oaTurn()), (err) => {
    assert.ok(/quota/.test(err.message), err.message);
    return true;
  });
});
