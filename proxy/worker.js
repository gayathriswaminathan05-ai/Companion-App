// Companion chat proxy (Cloudflare Worker).
//
// The desktop app points the official OpenAI SDK (/v1/responses → ChatGPT) or
// Anthropic SDK (/v1/messages → Claude) at this Worker. We check a few guards,
// add the real API key (which lives ONLY here, as a Cloudflare secret), forward
// the request, and stream the answer back untouched.
//
// PRIVACY (binding product rule): never log or store message content. There
// is deliberately no console.* anywhere in this file. The only thing ever
// written is a per-device daily counter in KV (a number, kept for ~2 days).

const UPSTREAM_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const OPENAI_URL = "https://api.openai.com/v1/responses";

const DEFAULT_ALLOWED_MODELS = "claude-sonnet-5,claude-haiku-5-5";
const DEFAULT_MAX_TOKENS_CAP = 2048;
const DEFAULT_OPENAI_MODELS = "gpt-6.1-sol,gpt-6-luna";
const DEFAULT_OPENAI_OUTPUT_CAP = 4096; // ChatGPT's "thinking" counts toward this too
// The only ChatGPT tool the app may use (others can run code or keep files).
const OPENAI_TOOLS = new Set(["web_search"]);
const DEFAULT_DAILY_LIMIT = 60;

// Blob's cloud voice (Google Text-to-Speech, Chirp 3 HD). The Google key is
// a Worker secret too (GOOGLE_TTS_KEY). Same privacy rule: text is passed to
// Google to be spoken and never logged or stored here.
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const TTS_LOCALES = ["en-US", "en-GB", "en-IN", "en-AU"];
const DEFAULT_TTS_DAILY_CHARS = 6000; // ~120 short spoken lines / device / day; then the app falls back to on-device
const TTS_MAX_CHARS = 600;

const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60; // counters expire after ~2 days
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Upstream response headers worth handing back to the SDK. Everything else
// (org ids, rate-limit details, content-encoding) is dropped.
const PASS_THROUGH_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "request-id",
  "x-request-id",
  "retry-after",
  "x-should-retry",
];

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx);
    } catch {
      return apiError(500, "api_error", "proxy_error");
    }
  },
};

async function handle(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname === "/health") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return apiError(405, "invalid_request_error", "method_not_allowed");
    }
    return jsonResponse(200, { ok: true });
  }

  if (url.pathname === "/v1/tts") {
    return handleTts(request, env, ctx);
  }

  if (url.pathname !== "/v1/messages" && url.pathname !== "/v1/responses") {
    return apiError(404, "not_found_error", "not_found");
  }
  if (request.method !== "POST") {
    return apiError(405, "invalid_request_error", "method_not_allowed");
  }
  const openai = url.pathname === "/v1/responses";

  if (!(openai ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY) || !env.APP_TOKEN || !env.RATE) {
    return apiError(500, "api_error", "proxy_not_configured");
  }

  // Guard 1: shared app token (weak, but stops drive-by abuse).
  const appToken = request.headers.get("x-companion-app") || "";
  if (!safeEqual(appToken, String(env.APP_TOKEN))) {
    return apiError(401, "authentication_error", "bad_app_token");
  }

  // Guard 2: anonymous device id must look like a UUID.
  const device = (request.headers.get("x-companion-device") || "").trim().toLowerCase();
  if (!UUID_RE.test(device)) {
    return apiError(400, "invalid_request_error", "bad_device_id");
  }

  // Parse the body (only to read model / token cap / tools / last role).
  const raw = await request.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return apiError(400, "invalid_request_error", "invalid_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError(400, "invalid_request_error", "invalid_json");
  }

  if (openai) return forwardOpenAI(body, url, request, env, ctx, device);

  // Guard 3: model allow-list.
  const allowedModels = String(env.ALLOWED_MODELS ?? DEFAULT_ALLOWED_MODELS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (typeof body.model !== "string" || !allowedModels.includes(body.model)) {
    return apiError(400, "invalid_request_error", "model_not_allowed");
  }

  // Guard 4: clamp max_tokens.
  let forwardBody = raw;
  const cap = intSetting(env.MAX_TOKENS_CAP, DEFAULT_MAX_TOKENS_CAP);
  if (typeof body.max_tokens === "number" && body.max_tokens > cap) {
    body.max_tokens = cap;
    forwardBody = JSON.stringify(body);
  }

  // Guard 5: daily limit per device. Only NEW user turns count (last message
  // is from the user). pause_turn continuations end with an assistant message,
  // so they never count and are never blocked.
  const countsTowardLimit = isNewUserTurn(body.messages);
  const counterKey = `d:${device}:${utcDay()}`;
  if (countsTowardLimit) {
    const limit = intSetting(env.DAILY_LIMIT, DEFAULT_DAILY_LIMIT);
    const used = await readCount(env.RATE, counterKey);
    if (used >= limit) {
      return apiError(429, "rate_limit_error", "daily_limit");
    }
  }

  // Forward to Anthropic with a fresh header set: the client's x-api-key /
  // authorization / x-companion-* headers are never passed on.
  const upstreamHeaders = new Headers({
    "content-type": "application/json",
    "x-api-key": String(env.ANTHROPIC_API_KEY),
    "anthropic-version": ANTHROPIC_VERSION,
  });
  const beta = request.headers.get("anthropic-beta");
  if (beta) upstreamHeaders.set("anthropic-beta", beta);
  const accept = request.headers.get("accept");
  if (accept) upstreamHeaders.set("accept", accept);

  let upstream;
  try {
    upstream = await fetch(UPSTREAM_URL + url.search, {
      method: "POST",
      headers: upstreamHeaders,
      body: forwardBody,
    });
  } catch {
    // Let the SDK retry network blips.
    return apiError(502, "api_error", "upstream_unreachable", { "x-should-retry": "true" });
  }

  // Count only turns Anthropic accepted, so SDK retries of failed requests
  // never eat into the user's daily allowance.
  if (countsTowardLimit && upstream.ok) {
    const bump = incrementCount(env.RATE, counterKey);
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(bump);
    else await bump;
  }

  return passThrough(upstream);
}

// ChatGPT (OpenAI Responses API). Same guards as Claude, plus: replies are
// never stored on OpenAI's side (store: false is forced) and only web search
// may be used as a tool.
async function forwardOpenAI(body, url, request, env, ctx, device) {
  const allowedModels = String(env.OPENAI_ALLOWED_MODELS ?? DEFAULT_OPENAI_MODELS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (typeof body.model !== "string" || !allowedModels.includes(body.model)) {
    return apiError(400, "invalid_request_error", "model_not_allowed");
  }
  if (body.tools !== undefined) {
    const ok = Array.isArray(body.tools) && body.tools.every((t) => t && OPENAI_TOOLS.has(t.type));
    if (!ok) return apiError(400, "invalid_request_error", "tool_not_allowed");
  }
  // Nothing that only works when OpenAI keeps the conversation.
  if (body.previous_response_id || body.conversation || body.background) {
    return apiError(400, "invalid_request_error", "stored_state_not_allowed");
  }
  const cap = intSetting(env.OPENAI_OUTPUT_CAP, DEFAULT_OPENAI_OUTPUT_CAP);
  if (typeof body.max_output_tokens !== "number" || body.max_output_tokens > cap) body.max_output_tokens = cap;
  body.store = false;

  // Daily limit: every ChatGPT request is one new user turn (no continuations).
  const countsTowardLimit = isNewUserTurn(body.input);
  const counterKey = `d:${device}:${utcDay()}`;
  if (countsTowardLimit) {
    const limit = intSetting(env.DAILY_LIMIT, DEFAULT_DAILY_LIMIT);
    const used = await readCount(env.RATE, counterKey);
    if (used >= limit) {
      return apiError(429, "rate_limit_error", "daily_limit");
    }
  }

  const upstreamHeaders = new Headers({
    "content-type": "application/json",
    authorization: `Bearer ${String(env.OPENAI_API_KEY)}`,
  });
  const accept = request.headers.get("accept");
  if (accept) upstreamHeaders.set("accept", accept);

  let upstream;
  try {
    upstream = await fetch(OPENAI_URL + url.search, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(body),
    });
  } catch {
    return apiError(502, "api_error", "upstream_unreachable", { "x-should-retry": "true" });
  }
  if (countsTowardLimit && upstream.ok) {
    const bump = incrementCount(env.RATE, counterKey);
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(bump);
    else await bump;
  }
  return passThrough(upstream);
}

function passThrough(upstream) {
  const headers = new Headers();
  for (const name of PASS_THROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  // Stream the body straight through (works for SSE and plain JSON alike).
  return new Response(upstream.body, { status: upstream.status, headers });
}

async function handleTts(request, env, ctx) {
  if (request.method !== "POST") {
    return apiError(405, "invalid_request_error", "method_not_allowed");
  }
  if (!env.GOOGLE_TTS_KEY || !env.APP_TOKEN || !env.RATE) {
    return apiError(500, "api_error", "tts_not_configured");
  }
  const appToken = request.headers.get("x-companion-app") || "";
  if (!safeEqual(appToken, String(env.APP_TOKEN))) {
    return apiError(401, "authentication_error", "bad_app_token");
  }
  const device = (request.headers.get("x-companion-device") || "").trim().toLowerCase();
  if (!UUID_RE.test(device)) {
    return apiError(400, "invalid_request_error", "bad_device_id");
  }

  let body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return apiError(400, "invalid_request_error", "invalid_json");
  }
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const languageCode = String(body?.languageCode || "");
  const voiceName = String(body?.voiceName || "");
  if (!text || text.length > TTS_MAX_CHARS) {
    return apiError(400, "invalid_request_error", "bad_text");
  }
  if (!TTS_LOCALES.includes(languageCode)) {
    return apiError(400, "invalid_request_error", "bad_language");
  }
  if (!new RegExp(`^${languageCode}-Chirp3-HD-[A-Z][a-z]+$`).test(voiceName)) {
    return apiError(400, "invalid_request_error", "bad_voice");
  }
  const rate = Number(body?.speakingRate);
  const speakingRate = Number.isFinite(rate) ? Math.min(1.3, Math.max(0.8, rate)) : 1;

  // Per-device daily character budget keeps the Google bill bounded.
  const counterKey = `t:${device}:${utcDay()}`;
  const limit = intSetting(env.TTS_DAILY_CHARS, DEFAULT_TTS_DAILY_CHARS);
  const used = await readCount(env.RATE, counterKey);
  if (used + text.length > limit) {
    return apiError(429, "rate_limit_error", "tts_daily_limit");
  }

  let upstream;
  try {
    upstream = await fetch(TTS_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": String(env.GOOGLE_TTS_KEY) },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: voiceName },
        audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000, speakingRate },
      }),
    });
  } catch {
    return apiError(502, "api_error", "tts_unreachable");
  }
  if (!upstream.ok) {
    return apiError(upstream.status === 429 ? 429 : 502, "api_error", `tts_upstream_${upstream.status}`);
  }
  const out = await upstream.json().catch(() => null);
  if (!out || typeof out.audioContent !== "string") {
    return apiError(502, "api_error", "tts_bad_upstream");
  }
  const bump = incrementCount(env.RATE, counterKey, text.length);
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(bump);
  else await bump;
  return jsonResponse(200, { audioContent: out.audioContent });
}

function isNewUserTurn(messages) {
  if (typeof messages === "string") return messages.trim().length > 0; // ChatGPT one-shot input
  if (!Array.isArray(messages) || messages.length === 0) return false;
  const last = messages[messages.length - 1];
  return !!last && last.role === "user";
}

async function readCount(kv, key) {
  try {
    const n = parseInt((await kv.get(key)) || "0", 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0; // KV hiccup: fail open rather than break chat
  }
}

async function incrementCount(kv, key, by = 1) {
  try {
    const n = await readCount(kv, key);
    await kv.put(key, String(n + by), { expirationTtl: COUNTER_TTL_SECONDS });
  } catch {
    // Counter write failed (e.g. free-plan KV write quota). Chat still works.
  }
}

function utcDay() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function intSetting(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

// Constant-time-ish string compare so the token can't be guessed by timing.
function safeEqual(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function jsonResponse(status, obj, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

// Anthropic-style error so the SDK raises its usual typed errors (OpenAI's SDK
// reads the same error.message field).
// x-should-retry: false stops the SDK from pointlessly retrying guard errors.
function apiError(status, type, message, extraHeaders = {}) {
  return jsonResponse(
    status,
    { type: "error", error: { type, message } },
    { "x-should-retry": "false", ...extraHeaders },
  );
}
