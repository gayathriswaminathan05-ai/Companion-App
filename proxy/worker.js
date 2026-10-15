// Companion chat proxy (Cloudflare Worker).
//
// The desktop app points the official Anthropic SDK at this Worker. We check a
// few guards, add the real API key (which lives ONLY here, as a Cloudflare
// secret), forward the request to api.anthropic.com, and stream the answer
// back untouched.
//
// PRIVACY (binding product rule): never log or store message content. There
// is deliberately no console.* anywhere in this file. The only thing ever
// written is a per-device daily counter in KV (a number, kept for ~2 days).

const UPSTREAM_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const DEFAULT_ALLOWED_MODELS = "claude-sonnet-5,claude-haiku-5-5";
const DEFAULT_MAX_TOKENS_CAP = 2048;
const DEFAULT_DAILY_LIMIT = 60;

const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60; // counters expire after ~2 days
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Upstream response headers worth handing back to the SDK. Everything else
// (org ids, rate-limit details, content-encoding) is dropped.
const PASS_THROUGH_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "request-id",
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

  if (url.pathname !== "/v1/messages") {
    return apiError(404, "not_found_error", "not_found");
  }
  if (request.method !== "POST") {
    return apiError(405, "invalid_request_error", "method_not_allowed");
  }

  if (!env.ANTHROPIC_API_KEY || !env.APP_TOKEN || !env.RATE) {
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

  // Parse the Messages API body (only to read model / max_tokens / last role).
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

  const headers = new Headers();
  for (const name of PASS_THROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  // Stream the body straight through (works for SSE and plain JSON alike).
  return new Response(upstream.body, { status: upstream.status, headers });
}

function isNewUserTurn(messages) {
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

async function incrementCount(kv, key) {
  try {
    const n = await readCount(kv, key);
    await kv.put(key, String(n + 1), { expirationTtl: COUNTER_TTL_SECONDS });
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

// Anthropic-style error so the SDK raises its usual typed errors.
// x-should-retry: false stops the SDK from pointlessly retrying guard errors.
function apiError(status, type, message, extraHeaders = {}) {
  return jsonResponse(
    status,
    { type: "error", error: { type, message } },
    { "x-should-retry": "false", ...extraHeaders },
  );
}
