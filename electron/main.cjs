// Main process: owns the transparent, always-on-top window the character lives in.
const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  nativeImage,
  systemPreferences,
  powerMonitor,
  shell,
  desktopCapturer,
} = require("electron");
const path = require("path");
const fs = require("fs");

// Keep ONE data folder no matter how the app is named or launched (dev runs
// and the installed "Companion.app" both read ~/Library/Application Support/
// companion-app), so tasks, chats, memories and logins survive the switch.
app.setPath("userData", path.join(app.getPath("appData"), "companion-app"));

const WIN_W = 384; // was 320 (+20%)
const WIN_H = 600; // was 500 (+20%)

const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function loadPosition() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    // Ignore a saved position that's now off-screen (monitor changed/unplugged).
    const onScreen = screen.getAllDisplays().some((d) => {
      const b = d.workArea;
      return s.x >= b.x - WIN_W && s.x <= b.x + b.width && s.y >= b.y - WIN_H && s.y <= b.y + b.height;
    });
    return onScreen ? s : null;
  } catch {
    return null;
  }
}

function savePosition(bounds) {
  try {
    fs.writeFileSync(
      stateFile(),
      JSON.stringify({ x: bounds.x, y: bounds.y, plantTop: plantBox.top, plantH: plantBox.height }),
    );
  } catch {}
}

let win = null;
// Where the plant sits INSIDE the transparent window (px from the window top).
// Normally at the bottom with UI stacked above; near the top of the screen the
// renderer flips it to the top with UI below (set-window-size tells us).
let plantBox = { top: WIN_H - 240, height: 240 };

/** Window y range that keeps the PLANT itself on screen (the transparent
 *  window around it may hang past the screen edge — enableLargerThanScreen). */
function clampPlantY(y, wa) {
  const minY = wa.y - plantBox.top;
  const maxY = wa.y + wa.height - plantBox.top - plantBox.height;
  return Math.round(Math.max(minY, Math.min(y, maxY)));
}

function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const saved = loadPosition();
  if (saved && Number.isFinite(saved.plantTop) && Number.isFinite(saved.plantH)) {
    plantBox = { top: saved.plantTop, height: saved.plantH };
  }
  // Clamp so the plant itself is on screen (the window may hang past an edge).
  const px = saved ? Math.min(saved.x, wa.x + wa.width - WIN_W) : wa.x + wa.width - WIN_W - 24;
  const py = saved ? clampPlantY(saved.y, wa) : wa.y + wa.height - WIN_H - 8;

  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: px,
    y: py,
    frame: false,
    // The plant floats beside other apps. The first click must operate its
    // controls, not be swallowed just to focus the inactive Mac window.
    acceptFirstMouse: true,
    transparent: true,
    resizable: false,
    // Lets the (mostly empty) window hang above the menu bar so the plant can
    // be dragged right up to the top of the screen. Drag/resize keep the
    // plant itself on screen via clampPlantY.
    enableLargerThanScreen: true,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Float above normal windows, follow the user across desktops/spaces.
  // skipTransformProcessType keeps the Dock icon visible (macOS otherwise
  // hides it when a window can appear over fullscreen apps).
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  });

  // Click-through by default; forwarded mouse moves let the page detect hover
  // over the character and ask us to become clickable again.
  win.setIgnoreMouseEvents(true, { forward: true });

  if (!app.isPackaged && process.env.COMPANION_DEBUG_INPUT === "1") {
    require("../scripts/debug-meditation-input.cjs")(win, () => clickThroughValue);
  }
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  // Always surface on launch — transparent click-through windows are easy to
  // "lose" (other Space, behind fullscreen, forgotten Focus hide).
  win.once("ready-to-show", () => {
    if (!win || win.isDestroyed()) return;
    win.show();
    win.moveTop();
    if (process.platform === "darwin" && app.dock) app.dock.show();
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("did-fail-load", code, desc);
  });

  win.on("moved", () => savePosition(win.getBounds()));
}

let clickThroughWindow = null;
let clickThroughValue = null;
ipcMain.on("set-click-through", (_e, ignore) => {
  if (!win) return;
  if (clickThroughWindow === win && clickThroughValue === ignore) return;
  clickThroughWindow = win;
  clickThroughValue = ignore;
  // forward:true only while ignoring — lets the page see hover and re-enable clicks
  // on the character. When capturing, omit forward so the window behaves normally.
  if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
  else win.setIgnoreMouseEvents(false);
});

// CSS client coords of the cursor inside the window, or null if outside.
// Used so click-through can recover even when mouseleave / move events are missed
// (common with transparent always-on-top windows on macOS).
ipcMain.handle("cursor-client-pos", () => {
  if (!win || win.isDestroyed()) return null;
  const point = screen.getCursorScreenPoint();
  const bounds = win.getContentBounds();
  if (
    point.x < bounds.x ||
    point.y < bounds.y ||
    point.x >= bounds.x + bounds.width ||
    point.y >= bounds.y + bounds.height
  ) {
    return null;
  }
  return { x: point.x - bounds.x, y: point.y - bounds.y };
});

// Manual drag: while dragging, the window follows the cursor ~60x per second.
let dragTimer = null;
let dragOffset = null;

ipcMain.on("drag-start", () => {
  if (!win || dragTimer) return;
  const cursor = screen.getCursorScreenPoint();
  const [wx, wy] = win.getPosition();
  dragOffset = { x: cursor.x - wx, y: cursor.y - wy };
  dragTimer = setInterval(() => {
    const p = screen.getCursorScreenPoint();
    const wa = screen.getDisplayNearestPoint(p).workArea;
    win.setPosition(p.x - dragOffset.x, clampPlantY(p.y - dragOffset.y, wa));
  }, 16);
});

ipcMain.on("drag-end", () => {
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
    if (win) savePosition(win.getBounds());
  }
});

ipcMain.on("quit-app", () => app.quit());
// Dev-only tools (growth test strip, right-click debug menu) hide in the
// installed app so beta testers never see them.
ipcMain.on("is-packaged", (e) => {
  e.returnValue = app.isPackaged;
});

// --- Local voice: Whisper (via transformers.js) running fully offline ------
let asrPromise = null;

function getAsr() {
  if (!asrPromise) {
    asrPromise = import("@huggingface/transformers").then(async ({ pipeline, env }) => {
      if (app.isPackaged) {
        // Installed app: the package folder is read-only. Use the Whisper
        // model bundled in Resources/models; any extra downloads go to
        // userData (never inside the app).
        env.localModelPath = path.join(process.resourcesPath, "models");
        env.allowLocalModels = true;
        env.cacheDir = path.join(app.getPath("userData"), "models");
      }
      // base.en: noticeably more accurate than tiny.en (especially with
      // accents) at ~74MB, still fast enough for live dictation chunks.
      // If accuracy still disappoints, the next step up is whisper-small.en.
      return pipeline("automatic-speech-recognition", "Xenova/whisper-base.en");
    });
  }
  return asrPromise;
}

ipcMain.handle("ensure-mic", async () => {
  if (process.platform === "darwin") {
    try {
      return await systemPreferences.askForMediaAccess("microphone");
    } catch {
      return false;
    }
  }
  return true;
});

// --- Backdrop brightness (opt-in "Match what's behind me") -----------------
// Lets panels turn dark over light apps and light over dark ones.
// PRIVACY: needs macOS Screen Recording permission, asked ONLY when the user
// turns the setting on. The capture is a small thumbnail kept in RAM, reduced
// to ONE average-brightness number, then dropped. Never saved, never sent.
function screenAccessStatus() {
  if (process.platform !== "darwin") return "granted";
  try {
    return systemPreferences.getMediaAccessStatus("screen");
  } catch {
    return "unknown";
  }
}

ipcMain.handle("screen-access", async (_e, opts = {}) => {
  let status = screenAccessStatus();
  if (status === "granted" || !opts.prompt) return status;
  if (status === "not-determined") {
    // Any capture attempt makes macOS show its one-time permission prompt.
    try {
      await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } });
    } catch {}
    status = screenAccessStatus();
  }
  if (status !== "granted" && process.platform === "darwin") {
    shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
  }
  return status;
});

// Average brightness (0 = black, 1 = white) of the screen in thin bands just
// outside the companion's panel area: left, right and above it. Our own
// window never sits in those bands, so this is what's really behind us.
ipcMain.handle("backdrop-luminance", async (_e, area = {}) => {
  if (!win || win.isDestroyed() || !win.isVisible()) return null;
  if (screenAccessStatus() !== "granted") return null;
  const b = win.getBounds();
  const display = screen.getDisplayMatching(b);
  const tw = Math.max(1, Math.round(display.size.width / 4));
  const th = Math.max(1, Math.round(display.size.height / 4));
  let sources;
  try {
    sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: tw, height: th } });
  } catch {
    return null;
  }
  const src = sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
  if (!src || src.thumbnail.isEmpty()) return null;
  const { width: iw, height: ih } = src.thumbnail.getSize();
  const bmp = src.thumbnail.toBitmap(); // BGRA
  const sx = iw / display.bounds.width;
  const sy = ih / display.bounds.height;
  const top = b.y + Math.max(0, Number(area.top) || 0);
  const bottom = b.y + Math.min(b.height, Number(area.bottom) || b.height);
  const M = 40; // band thickness in points
  const bands = [
    { x: b.x - M, y: top, w: M, h: bottom - top },
    { x: b.x + b.width, y: top, w: M, h: bottom - top },
    { x: b.x, y: top - M - 4, w: b.width, h: M },
  ];
  let sum = 0;
  let n = 0;
  for (const r of bands) {
    const x0 = Math.max(0, Math.floor((r.x - display.bounds.x) * sx));
    const x1 = Math.min(iw, Math.ceil((r.x + r.w - display.bounds.x) * sx));
    const y0 = Math.max(0, Math.floor((r.y - display.bounds.y) * sy));
    const y1 = Math.min(ih, Math.ceil((r.y + r.h - display.bounds.y) * sy));
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * iw + x) * 4;
        sum += (0.0722 * bmp[i] + 0.7152 * bmp[i + 1] + 0.2126 * bmp[i + 2]) / 255;
        n++;
      }
    }
  }
  return n ? sum / n : null;
});

ipcMain.handle("transcribe", async (_e, audioBuffer) => {
  try {
    const asr = await getAsr();
    const audio = new Float32Array(audioBuffer);
    if (audio.length < 1600) return null; // <0.1s — ignore accidental taps
    const out = await asr(audio);
    return out && out.text ? String(out.text) : null;
  } catch (err) {
    console.error("transcribe failed:", err && err.message);
    return null;
  }
});

// --- Chat brain: ChatGPT (OpenAI) or Claude (Anthropic). Key lives ONLY in a
// local file on this machine. Which AI answers is decided by the key itself:
// Claude keys start "sk-ant-", anything else is an OpenAI key. ---
const keyFile = () => path.join(app.getPath("userData"), "brain.key");

function loadBrainKey() {
  try {
    const k = fs.readFileSync(keyFile(), "utf8").trim();
    return k || null;
  } catch {
    return process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || null;
  }
}

// Beta / public builds: no key in the app. Chats go through our private proxy
// (proxy/worker.js) which holds the key server-side and applies per-device
// daily limits. electron/beta-config.json = { "proxyUrl", "appToken",
// "provider": "openai" | "anthropic" (default anthropic) } is
// gitignored and bundled at build time. A key saved on this Mac (founder /
// dev) still wins, so local testing never touches the proxy allowance.
function loadBetaConfig() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, "beta-config.json"), "utf8"));
    if (j && j.proxyUrl && j.appToken) return j;
  } catch {}
  return null;
}
const betaConfig = loadBetaConfig();

// Anonymous random id so the proxy can count per-device chats. Not linked to
// any account, name or email.
function deviceId() {
  const f = path.join(app.getPath("userData"), "device-id");
  try {
    const id = fs.readFileSync(f, "utf8").trim();
    if (id) return id;
  } catch {}
  const id = require("crypto").randomUUID();
  try {
    fs.writeFileSync(f, id);
  } catch {}
  return id;
}

function brainProvider() {
  const key = loadBrainKey();
  if (key) return key.startsWith("sk-ant-") ? "anthropic" : "openai";
  if (betaConfig) return betaConfig.provider === "openai" ? "openai" : "anthropic";
  return null;
}

const brainClients = {}; // provider → SDK client
function resetBrains() {
  for (const k of Object.keys(brainClients)) delete brainClients[k];
}

function getBrain() {
  const provider = brainProvider();
  if (!provider) return null;
  if (!brainClients[provider]) {
    const key = loadBrainKey();
    const SDK = provider === "openai" ? require("openai").default : require("@anthropic-ai/sdk");
    if (key) {
      brainClients[provider] = new SDK({ apiKey: key });
    } else {
      const base = betaConfig.proxyUrl.replace(/\/+$/, "");
      brainClients[provider] = new SDK({
        apiKey: "unused", // the real key lives only on the proxy
        // OpenAI's SDK adds "/responses" to its base, Anthropic's adds "/v1/messages".
        baseURL: provider === "openai" ? `${base}/v1` : base,
        defaultHeaders: {
          "x-companion-device": deviceId(),
          "x-companion-app": betaConfig.appToken,
        },
      });
    }
  }
  return { provider, client: brainClients[provider] };
}

// --- Cloud voice: Google Text-to-Speech (Chirp 3 HD), accent per country ---
// Testers go through our proxy (/v1/tts, key lives on the server). The founder
// can test without the proxy by putting a Google API key in userData/
// google-tts.key. Returns { sampleRate, pcm } exactly like Kokoro, or null so
// the caller falls back to the on-device voice (offline, quota, errors).
const ttsKeyFile = () => path.join(app.getPath("userData"), "google-tts.key");
function loadTtsKey() {
  try {
    return fs.readFileSync(ttsKeyFile(), "utf8").trim() || null;
  } catch {
    return process.env.GOOGLE_TTS_KEY || null;
  }
}

function wavToPcm(buf) {
  // Google LINEAR16 = RIFF/WAV with a header; walk chunks to fmt + data.
  let sampleRate = 24000;
  let start = 0;
  let end = buf.length;
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF") {
    let off = 12;
    while (off + 8 <= buf.length) {
      const id = buf.toString("ascii", off, off + 4);
      const size = buf.readUInt32LE(off + 4);
      if (id === "fmt ") sampleRate = buf.readUInt32LE(off + 12);
      if (id === "data") {
        start = off + 8;
        end = Math.min(buf.length, start + size);
        break;
      }
      off += 8 + size + (size % 2);
    }
  }
  const n = Math.floor((end - start) / 2);
  const f32 = new Float32Array(n);
  for (let i = 0; i < n; i++) f32[i] = buf.readInt16LE(start + i * 2) / 32768;
  return { sampleRate, pcm: f32.buffer };
}

async function cloudSynthesize({ text, languageCode, voiceName, speed }) {
  const speakingRate = Math.min(1.3, Math.max(0.8, Number(speed) || 1));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    let res;
    const key = loadTtsKey();
    if (key) {
      res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode, name: voiceName },
          audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000, speakingRate },
        }),
        signal: ctrl.signal,
      });
    } else if (betaConfig) {
      res = await fetch(`${betaConfig.proxyUrl.replace(/\/+$/, "")}/v1/tts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-companion-device": deviceId(),
          "x-companion-app": betaConfig.appToken,
        },
        body: JSON.stringify({ text, languageCode, voiceName, speakingRate }),
        signal: ctrl.signal,
      });
    } else {
      return null;
    }
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || typeof json.audioContent !== "string") return null;
    return wavToPcm(Buffer.from(json.audioContent, "base64"));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const cloudVoice = {
  // Beta ships with the on-device voice: testers only get the Google voice
  // once beta-config.json says "cloudVoice": true (proxy has GOOGLE_TTS_KEY).
  available: () => !!(loadTtsKey() || (betaConfig && betaConfig.cloudVoice === true)),
  synthesize: cloudSynthesize,
};

ipcMain.handle("voice-cloud-info", () => ({
  available: cloudVoice.available(),
  // e.g. "en-IN" — the Mac's region decides the default accent.
  systemLocale: app.getSystemLocale ? app.getSystemLocale() : app.getLocale(),
}));

ipcMain.on("open-link", (_e, url) => {
  try {
    const u = String(url);
    if (u.startsWith("http://") || u.startsWith("https://")) shell.openExternal(u);
  } catch {}
});

ipcMain.handle("brain-status", () => ({
  connected: !!loadBrainKey() || !!betaConfig,
  viaProxy: !loadBrainKey() && !!betaConfig,
  provider: brainProvider(),
}));

ipcMain.handle("brain-connect", (_e, key) => {
  try {
    fs.writeFileSync(keyFile(), String(key).trim(), { mode: 0o600 });
    resetBrains(); // rebuild with the new key (it may be a different AI)
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

// AI chat on/off (Settings → Privacy → "Chat with AI"). Read from the saved
// settings, so even if the screen asked, nothing goes to the AI while it's off.
function chatAllowed() {
  try {
    const d = JSON.parse(fs.readFileSync(dataFile(), "utf8"));
    return !(d && d.settings && d.settings.chatOn === false);
  } catch {
    return true;
  }
}

// Chat models — swap one line to change brains.
// Claude: Sonnet (owner chose it for cost). ChatGPT: gpt-6.1-sol is the same
// tier ($2 / $10 per million tokens in / out, Oct 2026); "gpt-6-luna" is the
// budget pick ($0.10 / $0.50) if replies still feel like the plant.
const CHAT_MODEL = "claude-sonnet-5";
const OPENAI_CHAT_MODEL = "gpt-6.1-sol";

// brain.ts builds the system prompt as Claude-style blocks; ChatGPT takes one string.
function systemText(system) {
  return Array.isArray(system) ? system.map((b) => (b && b.text) || "").join("\n\n") : String(system || "");
}

// Rough place for web search ("movies near me"): country + time zone only.
function searchLocation() {
  const loc = { type: "approximate" };
  const locale = app.getSystemLocale ? app.getSystemLocale() : app.getLocale();
  const region = String(locale || "").split(/[-_]/)[1];
  if (/^[A-Z]{2}$/.test(region || "")) loc.country = region;
  try {
    loc.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {}
  return loc;
}

// Claude: streaming chat with web search; continues across pause_turn automatically.
async function chatClaude(client, system, messages, onText) {
  let msgs = [...messages];
  let full = "";
  const sources = [];
  for (let hop = 0; hop < 4; hop++) {
    const stream = client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 2048,
      system,
      messages: msgs,
      // "direct" = plain web search. The default for this tool version runs the
      // search inside Anthropic's code sandbox (kept up to 30 days, not covered
      // by zero data retention), so we turn that off.
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8, allowed_callers: ["direct"] }],
    });
    stream.on("text", (t) => {
      full += t;
      onText(t);
    });
    const final = await stream.finalMessage();
    for (const b of final.content) {
      if (b.type === "text" && Array.isArray(b.citations)) {
        for (const c of b.citations) {
          if (c.url && !sources.some((s) => s.url === c.url)) {
            sources.push({ url: c.url, title: c.title || c.url });
          }
        }
      }
    }
    if (final.stop_reason === "pause_turn") {
      msgs = [...msgs, { role: "assistant", content: final.content }];
      continue;
    }
    break;
  }
  return { text: full, sources };
}

// ChatGPT: one streaming request; OpenAI runs the web searches itself.
async function chatOpenAI(client, system, messages, onText) {
  const stream = client.responses.stream({
    model: OPENAI_CHAT_MODEL,
    instructions: systemText(system),
    input: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: [{ type: "web_search", user_location: searchLocation() }],
    reasoning: { effort: "low" }, // quick, chatty replies (thinking counts toward max_output_tokens)
    max_output_tokens: 4096,
    store: false, // privacy: OpenAI doesn't keep the reply around for later lookup
    prompt_cache_key: "companion-chat", // same personality every time → cheaper cached input
  });
  let full = "";
  let lastItem = null;
  stream.on("response.output_text.delta", (ev) => {
    // Text before and after a web search arrives as separate pieces: keep a gap.
    const t = full && lastItem !== null && ev.output_index !== lastItem ? `\n\n${ev.delta}` : ev.delta;
    lastItem = ev.output_index;
    full += t;
    onText(t);
  });
  const final = await stream.finalResponse();
  const sources = [];
  for (const item of final.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      if (part.type !== "output_text") continue;
      for (const a of part.annotations || []) {
        if (a.type === "url_citation" && a.url && !sources.some((s) => s.url === a.url)) {
          sources.push({ url: a.url, title: a.title || a.url });
        }
      }
    }
  }
  if (!full.trim() && final.status === "incomplete") {
    throw new Error(`incomplete reply (${(final.incomplete_details && final.incomplete_details.reason) || "unknown"})`);
  }
  return { text: full, sources };
}

ipcMain.handle("chat-send", async (e, { id, system, messages }) => {
  if (!chatAllowed()) return { ok: false, error: "chat-off" };
  const brain = getBrain();
  if (!brain) return { ok: false, error: "no-key" };
  const send = (channel, payload) => {
    try {
      e.sender.send(channel, payload);
    } catch {}
  };
  try {
    const chat = brain.provider === "openai" ? chatOpenAI : chatClaude;
    const { text, sources } = await chat(brain.client, system, messages, (delta) => send("chat-chunk", { id, delta }));
    send("chat-done", { id, text, sources });
    return { ok: true };
  } catch (err) {
    const msg = String((err && err.message) || err);
    send("chat-error", { id, error: msg });
    return { ok: false, error: msg };
  }
});

// One-shot small requests (jokes, summaries) — no streaming, no tools.
ipcMain.handle("brain-once", async (_e, { system, prompt, maxTokens }) => {
  if (!chatAllowed()) return { ok: false, error: "chat-off" };
  const brain = getBrain();
  if (!brain) return { ok: false, error: "no-key" };
  try {
    if (brain.provider === "openai") {
      const res = await brain.client.responses.create({
        model: OPENAI_CHAT_MODEL,
        instructions: systemText(system),
        input: prompt,
        reasoning: { effort: "low" },
        max_output_tokens: Math.max(1024, maxTokens || 300),
        store: false,
      });
      return { ok: true, text: res.output_text || "" };
    }
    const res = await brain.client.messages.create({
      model: CHAT_MODEL,
      max_tokens: maxTokens || 300,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

// --- Call detection: auto-tuck during Zoom / Google Meet calls -------------
const { exec } = require("child_process");
let callAutoHide = true;
let hiddenForCall = false;

ipcMain.on("set-call-autohide", (_e, v) => {
  callAutoHide = !!v;
});

function checkZoomCall(cb) {
  // Zoom runs the "CptHost" helper only while actually in a meeting.
  exec("pgrep -x CptHost", (err) => cb(!err));
}

function checkMeetCall(cb) {
  exec('pgrep -x "Google Chrome"', (err) => {
    if (err) return cb(false);
    exec(
      `osascript -e 'tell application "Google Chrome" to get URL of tabs of every window' 2>/dev/null`,
      { timeout: 4000 },
      (e, out) => cb(!e && /meet\.google\.com\/[a-z]{3}-/.test(String(out))),
    );
  });
}

function onCallState(active) {
  if (!win) return;
  if (active && callAutoHide && win.isVisible()) {
    hiddenForCall = true;
    win.hide();
    updateTrayMenu();
  } else if (!active && hiddenForCall) {
    hiddenForCall = false;
    if (!win.isVisible()) {
      win.show();
      updateTrayMenu();
    }
  }
}

setInterval(() => {
  if (!callAutoHide && !hiddenForCall) return;
  checkZoomCall((zoom) => {
    if (zoom) return onCallState(true);
    checkMeetCall((meet) => onCallState(meet));
  });
}, 10000);

// --- Settings-backed app controls ------------------------------------------
ipcMain.handle("get-login-item", () => {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
});

ipcMain.handle("set-login-item", (_e, on) => {
  try {
    app.setLoginItemSettings({ openAtLogin: !!on });
    updateTrayMenu();
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("brain-disconnect", () => {
  try {
    fs.unlinkSync(keyFile());
  } catch {}
  resetBrains();
  return true;
});

ipcMain.handle("data-reset", () => {
  try {
    fs.unlinkSync(dataFile());
  } catch {}
  try {
    const { clearTokens, clearClient, stopPolling } = require("./calendar.cjs");
    clearTokens();
    clearClient();
    stopPolling();
  } catch {}
  if (win) win.reload();
  return true;
});

// Persistent data (todos, sprout progress, settings) in one JSON file.
const dataFile = () => path.join(app.getPath("userData"), "companion-data.json");

// How much of the window is hanging off the screen (for edge-aware menus/panels).
function getLayoutInfo() {
  if (!win) return { clipLeft: 0, clipRight: 0, clipTop: 0, clipBottom: 0 };
  const b = win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  return {
    clipLeft: Math.max(0, wa.x - b.x),
    clipRight: Math.max(0, b.x + b.width - (wa.x + wa.width)),
    clipTop: Math.max(0, wa.y - b.y),
    clipBottom: Math.max(0, b.y + b.height - (wa.y + wa.height)),
    // For the renderer's "UI above or below the plant?" decision.
    winY: b.y,
    workTop: wa.y,
    workBottom: wa.y + wa.height,
    plantTop: plantBox.top,
  };
}

ipcMain.handle("layout-info", () => getLayoutInfo());

// Resize the transparent window (panel scale) and/or move the plant inside it
// (UI above ↔ below near the top of the screen) while the plant stays visually
// put: the window shifts by however much the plant moved inside it.
ipcMain.handle("set-window-size", (_e, size = {}) => {
  if (!win) return getLayoutInfo();
  const w = Math.max(280, Math.min(560, Math.round(Number(size.width) || WIN_W)));
  const h = Math.max(420, Math.min(1000, Math.round(Number(size.height) || WIN_H)));
  const b = win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  const plantH = Number.isFinite(size.plantH) ? Math.round(size.plantH) : plantBox.height;
  const plantTop = Number.isFinite(size.plantTop) ? Math.round(size.plantTop) : h - plantH;
  let x = Math.round(b.x + (b.width - w) / 2);
  let y = Math.round(b.y + plantBox.top - plantTop);
  plantBox = { top: plantTop, height: plantH };
  // Keep a usable strip on-screen sideways; keep the plant on screen vertically.
  x = Math.min(x, wa.x + wa.width - 120);
  x = Math.max(x, wa.x + 120 - w);
  y = clampPlantY(y, wa);
  if (b.width !== w || b.height !== h || b.x !== x || b.y !== y) {
    win.setBounds({ x, y, width: w, height: h });
    savePosition(win.getBounds());
  }
  return getLayoutInfo();
});

ipcMain.handle("data-load", () => {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), "utf8"));
  } catch {
    return null;
  }
});

ipcMain.handle("data-save", (_e, data) => {
  try {
    // Privacy: never persist calendar event payloads (titles/times/ids).
    // Only settings.calendarReminders / calendarLeadMins are allowed.
    if (data && typeof data === "object") {
      delete data.calendar;
      delete data.calendarEvents;
      delete data.meetings;
      if (data.settings && typeof data.settings === "object") {
        delete data.settings.calendarEvents;
        delete data.settings.lastMeeting;
      }
    }
    fs.writeFileSync(dataFile(), JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
});

// Seconds since the user last touched mouse/keyboard (for wellness nudges).
ipcMain.handle("idle-seconds", () => powerMonitor.getSystemIdleTime());

// Menu-bar (tray) home: dismiss the companion here and bring it back anytime.
let tray = null;
let focusTimer = null;

function hideFor(minutes) {
  if (!win) return;
  win.hide();
  if (focusTimer) clearTimeout(focusTimer);
  focusTimer = setTimeout(() => {
    focusTimer = null;
    if (win && !win.isVisible()) win.show();
    updateTrayMenu();
  }, minutes * 60 * 1000);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray || !win) return;
  let loginEnabled = false;
  try {
    loginEnabled = app.getLoginItemSettings().openAtLogin;
  } catch {}
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: win.isVisible() ? "Hide companion" : "Show companion",
        click: () => toggleCompanion(),
      },
      { label: "Focus: hide for 30 min", click: () => hideFor(30) },
      { label: "Focus: hide for 1 hour", click: () => hideFor(60) },
      { type: "separator" },
      {
        label: "Start at login",
        type: "checkbox",
        checked: loginEnabled,
        click: () => {
          try {
            app.setLoginItemSettings({ openAtLogin: !loginEnabled });
          } catch {}
          updateTrayMenu();
        },
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
}

function toggleCompanion() {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    if (focusTimer) {
      clearTimeout(focusTimer);
      focusTimer = null;
    }
    win.show();
  }
  updateTrayMenu();
}

ipcMain.on("hide-app", () => {
  if (win) win.hide();
  updateTrayMenu();
});

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("🍡");
  tray.setToolTip("Your companion");
  updateTrayMenu();
}

// Quitting: onnxruntime (Whisper on the main thread, Kokoro in its worker)
// crashes if Node tears it down normally (SIGTRAP in session finalizers) or if
// the worker is terminated mid-LoadModel (SIGSEGV) — both showed macOS's
// "quit unexpectedly" dialog. So: release Whisper's sessions (best effort, max
// ~1s), then end the process with SIGKILL, which skips teardown entirely and
// never produces a crash report. Safe because every save (data, window
// position, tokens) is written synchronously the moment it happens.
let voiceEngine = null;
let quittingNow = false;
app.on("before-quit", (e) => {
  e.preventDefault();
  if (quittingNow) return;
  quittingNow = true;
  try {
    if (win && !win.isDestroyed()) savePosition(win.getBounds());
  } catch {}
  try {
    if (voiceEngine && voiceEngine.dispose) voiceEngine.dispose(); // ends the voice process
  } catch {}
  const release = asrPromise
    ? asrPromise.then((p) => p && p.dispose && p.dispose()).catch(() => {})
    : Promise.resolve();
  const timeout = new Promise((r) => setTimeout(r, 1000));
  Promise.race([release, timeout]).finally(() => process.kill(process.pid, "SIGKILL"));
});

app.whenReady().then(() => {
  // On-device voice (Kokoro, worker thread). Model ships in Resources/models;
  // dev runs download it once into userData/models.
  try {
    const { registerVoiceIpc } = require("./voice.cjs");
    voiceEngine = registerVoiceIpc({
      ipcMain,
      cloud: cloudVoice,
      cacheDir: path.join(app.getPath("userData"), "models"),
      bundledModelsDir: app.isPackaged
        ? path.join(process.resourcesPath, "models")
        : path.join(__dirname, "..", "models"), // gitignored copy in the repo
    });
  } catch (e) {
    console.error("voice ipc failed", e);
  }
  createWindow();
  try {
    const { registerCalendarIpc } = require("./calendar.cjs");
    registerCalendarIpc({
      getUserDataPath: () => app.getPath("userData"),
      getWindow: () => win,
      dataFile,
    });
  } catch (e) {
    console.error("calendar ipc failed", e);
  }
  // Menu-bar (tray) presence removed by user request — the Dock icon is the
  // app's single home: click to summon, right-click → Quit.
  // Warm up the voice model in the background so the first mic use is fast.
  setTimeout(() => getAsr().catch(() => {}), 4000);
  if (process.platform === "darwin" && app.dock) {
    const icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "icon.png"));
    if (!icon.isEmpty()) app.dock.setIcon(icon);
  }
  win.on("show", updateTrayMenu);
  win.on("hide", updateTrayMenu);
});

// Clicking the Dock icon brings the companion back.
app.on("activate", () => {
  if (win && !win.isVisible()) {
    win.show();
    updateTrayMenu();
  }
});

app.on("window-all-closed", () => app.quit());
