// Gmail new-mail alerts — "you've got mail" bubbles only.
// PRIVACY (binding, PRD §6b):
//  - Scope is gmail.metadata: Google only gives us headers + labels, NEVER
//    email bodies or attachments.
//  - We ask for exactly two headers (From, Subject). The sender's display name
//    and the subject live in RAM just long enough to send ONE bubble to the
//    renderer, then go out of scope. Never written to disk, never sent to
//    any AI service.
//  - The only thing we remember is a RAM Set of opaque Gmail message ids (so
//    we don't alert twice). It's capped and wiped on stop / disconnect.
// Started/stopped by calendar.cjs (shared Google connection + token refresh).

const LIST_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const POLL_MS = 120_000; // every 2 minutes
const FIRST_POLL_DELAY_MS = 5_000;
const SEEN_CAP = 500;
const BATCH_OVER = 3; // more than this many new at once → one "N new emails" bubble
const SUBJECT_MAX = 120;
const NAME_MAX = 80;

/**
 * "Riya Shah <riya@x.com>" → "Riya Shah"; "<a@b.com>" → "a"; "a@b.com" → "a";
 * "riya@x.com (Riya Shah)" → "Riya Shah". Display name only — no address.
 * @param {string} fromHeader
 */
function senderName(fromHeader) {
  const raw = String(fromHeader || "").trim();
  if (!raw) return "";
  let name = "";
  let email = "";
  const angle = raw.match(/^(.*?)<\s*([^>]*?)\s*>\s*$/s);
  if (angle) {
    name = angle[1];
    email = angle[2];
  } else {
    const paren = raw.match(/^([^\s()]+@[^\s()]+)\s*\((.*)\)\s*$/s);
    if (paren) {
      email = paren[1];
      name = paren[2];
    } else {
      email = raw;
    }
  }
  name = name
    .trim()
    .replace(/^"([\s\S]*)"$/, "$1")
    .replace(/\\(.)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const bareName = name.replace(/^['"]+|['"]+$/g, "");
  // Some senders put the address itself in the name slot — treat as no name.
  if (bareName && bareName.toLowerCase() === email.toLowerCase()) name = "";
  if (name) return name.slice(0, NAME_MAX);
  const local = email.split("@")[0].replace(/^['"<\s]+|['">\s]+$/g, "").trim();
  return local.slice(0, NAME_MAX);
}

/** Collapse whitespace and cap at 120 chars (ellipsis included). */
function cleanSubject(subject) {
  const t = String(subject || "").replace(/\s+/g, " ").trim();
  return t.length > SUBJECT_MAX ? t.slice(0, SUBJECT_MAX - 1) + "…" : t;
}

function headerValue(headers, name) {
  const want = name.toLowerCase();
  for (const h of headers || []) {
    if (String(h?.name || "").toLowerCase() === want) return String(h.value || "");
  }
  return "";
}

/**
 * @param {{
 *   getAccessToken: () => Promise<string | null>,
 *   getWindow: () => (import('electron').BrowserWindow | null),
 *   pollMs?: number,
 *   firstDelayMs?: number,
 * }} deps
 */
function createGmailWatcher(deps) {
  const pollMs = deps.pollMs || POLL_MS;
  const firstDelayMs = deps.firstDelayMs ?? FIRST_POLL_DELAY_MS;

  /** Opaque message ids only — no senders/subjects. Insertion-ordered for capping. */
  const seen = new Set();
  let running = false;
  let primed = false; // first successful poll after start = silent baseline
  let inFlight = false;
  let interval = null;
  let firstTimer = null;

  function markSeen(id) {
    // delete+add moves it to the "newest" end so ids still in the inbox
    // never get evicted by the cap
    seen.delete(id);
    seen.add(id);
    while (seen.size > SEEN_CAP) seen.delete(seen.values().next().value);
  }

  function liveWindow() {
    const w = deps.getWindow();
    if (!w || (typeof w.isDestroyed === "function" && w.isDestroyed())) return null;
    return w;
  }

  function send(payload) {
    const w = liveWindow();
    if (w) w.webContents.send("gmail-new", payload);
  }

  async function getJson(url, access) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, json: await res.json() };
  }

  /** One poll. Safe to call any time; no-ops when stopped, hidden or busy. */
  async function pollOnce() {
    if (!running || inFlight) return;
    const w = liveWindow();
    // Tucked away (focus mode / on a call / hidden) → don't even ask Google.
    if (!w || (typeof w.isVisible === "function" && !w.isVisible())) return;
    inFlight = true;
    try {
      const access = await deps.getAccessToken();
      if (!access || !running) return;

      const url = new URL(LIST_URL);
      // NOTE: gmail.metadata does NOT allow `q=` searches — labelIds only
      // (multiple labelIds are AND-ed by Gmail).
      url.searchParams.append("labelIds", "INBOX");
      url.searchParams.append("labelIds", "UNREAD");
      url.searchParams.append("labelIds", "CATEGORY_PERSONAL");
      url.searchParams.set("maxResults", "15");
      const list = await getJson(url, access);
      if (!list.ok || !running) return; // 401/403/network: try again next tick

      const ids = (list.json.messages || []).map((m) => String(m.id)).filter(Boolean);

      if (!primed) {
        // Baseline: whatever is already unread isn't "new" — stay quiet.
        for (const id of ids) markSeen(id);
        primed = true;
        return;
      }

      const fresh = ids.filter((id) => !seen.has(id));
      for (const id of ids) if (seen.has(id)) markSeen(id); // keep listed ids warm
      if (fresh.length === 0) return;

      if (fresh.length > BATCH_OVER) {
        for (const id of fresh) markSeen(id);
        send({ id: "batch", from: "", subject: "", count: fresh.length });
        return;
      }

      // Gmail lists newest first; alert oldest first so the newest lands last.
      for (const id of fresh.slice().reverse()) {
        if (!running) return;
        const m = new URL(`${LIST_URL}/${encodeURIComponent(id)}`);
        m.searchParams.set("format", "metadata");
        m.searchParams.append("metadataHeaders", "From");
        m.searchParams.append("metadataHeaders", "Subject");
        const r = await getJson(m, access);
        if (!r.ok) {
          // Gone (deleted/moved) → forget it. Anything else → retry next poll.
          if (r.status === 404) markSeen(id);
          continue;
        }
        markSeen(id);
        const headers = r.json.payload?.headers;
        send({
          id,
          from: senderName(headerValue(headers, "From")),
          subject: cleanSubject(headerValue(headers, "Subject")),
        });
        // headers / names / subjects go out of scope here — nothing persisted
      }
    } catch {
      /* network blip — next tick */
    } finally {
      inFlight = false;
    }
  }

  function start() {
    if (running) return;
    running = true;
    primed = false;
    interval = setInterval(() => void pollOnce(), pollMs);
    firstTimer = setTimeout(() => void pollOnce(), firstDelayMs);
  }

  function stop() {
    running = false;
    primed = false;
    if (interval) clearInterval(interval);
    if (firstTimer) clearTimeout(firstTimer);
    interval = null;
    firstTimer = null;
    seen.clear();
  }

  return {
    start,
    stop,
    pollOnce,
    isRunning: () => running,
    /** for dev tests only */
    _seenCount: () => seen.size,
  };
}

module.exports = { createGmailWatcher, senderName, cleanSubject, SEEN_CAP };
