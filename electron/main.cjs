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
} = require("electron");
const path = require("path");
const fs = require("fs");

const WIN_W = 320;
const WIN_H = 500;

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
    fs.writeFileSync(stateFile(), JSON.stringify({ x: bounds.x, y: bounds.y }));
  } catch {}
}

let win = null;

function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  const saved = loadPosition();
  // Clamp so the (possibly larger) window never hangs off-screen.
  const px = saved ? Math.min(saved.x, wa.x + wa.width - WIN_W) : wa.x + wa.width - WIN_W - 24;
  const py = saved ? Math.min(saved.y, wa.y + wa.height - WIN_H) : wa.y + wa.height - WIN_H - 8;

  win = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: px,
    y: py,
    frame: false,
    transparent: true,
    resizable: false,
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

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  win.on("moved", () => savePosition(win.getBounds()));
}

ipcMain.on("set-click-through", (_e, ignore) => {
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
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
    win.setPosition(p.x - dragOffset.x, p.y - dragOffset.y);
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

// --- Local voice: Whisper (via transformers.js) running fully offline ------
let asrPromise = null;

function getAsr() {
  if (!asrPromise) {
    asrPromise = import("@huggingface/transformers").then(async ({ pipeline }) => {
      // Downloads the small English model on first run (~40MB), then cached.
      return pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en");
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

// --- Chat brain: Claude API. Key lives ONLY in a local file on this machine. ---
const keyFile = () => path.join(app.getPath("userData"), "brain.key");

function loadBrainKey() {
  try {
    const k = fs.readFileSync(keyFile(), "utf8").trim();
    return k || null;
  } catch {
    return process.env.ANTHROPIC_API_KEY || null;
  }
}

let anthropicClient = null;

function getBrain() {
  if (!anthropicClient) {
    const key = loadBrainKey();
    if (!key) return null;
    const Anthropic = require("@anthropic-ai/sdk");
    anthropicClient = new Anthropic({ apiKey: key });
  }
  return anthropicClient;
}

ipcMain.on("open-link", (_e, url) => {
  try {
    const u = String(url);
    if (u.startsWith("http://") || u.startsWith("https://")) shell.openExternal(u);
  } catch {}
});

ipcMain.handle("brain-status", () => ({ connected: !!loadBrainKey() }));

ipcMain.handle("brain-connect", (_e, key) => {
  try {
    fs.writeFileSync(keyFile(), String(key).trim(), { mode: 0o600 });
    anthropicClient = null; // rebuild with the new key
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

// Chat model — swap this one line to change brains (user chose Sonnet for cost).
const CHAT_MODEL = "claude-sonnet-5";

// Streaming chat with web search; continues across pause_turn automatically.
ipcMain.handle("chat-send", async (e, { id, system, messages }) => {
  const client = getBrain();
  if (!client) return { ok: false, error: "no-key" };
  try {
    let msgs = [...messages];
    let full = "";
    const sources = [];
    for (let hop = 0; hop < 4; hop++) {
      const stream = client.messages.stream({
        model: CHAT_MODEL,
        max_tokens: 2048,
        system,
        messages: msgs,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
      });
      stream.on("text", (t) => {
        full += t;
        try {
          e.sender.send("chat-chunk", { id, delta: t });
        } catch {}
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
    e.sender.send("chat-done", { id, text: full, sources });
    return { ok: true };
  } catch (err) {
    const msg = String((err && err.message) || err);
    try {
      e.sender.send("chat-error", { id, error: msg });
    } catch {}
    return { ok: false, error: msg };
  }
});

// One-shot small requests (jokes, summaries) — no streaming, no tools.
ipcMain.handle("brain-once", async (_e, { system, prompt, maxTokens }) => {
  const client = getBrain();
  if (!client) return { ok: false, error: "no-key" };
  try {
    const res = await client.messages.create({
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
  anthropicClient = null;
  return true;
});

ipcMain.handle("data-reset", () => {
  try {
    fs.unlinkSync(dataFile());
  } catch {}
  if (win) win.reload();
  return true;
});

// Persistent data (todos, sprout progress, settings) in one JSON file.
const dataFile = () => path.join(app.getPath("userData"), "companion-data.json");

// How much of the window is hanging off the screen (for edge-aware menus).
ipcMain.handle("layout-info", () => {
  if (!win) return { clipLeft: 0, clipRight: 0 };
  const b = win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  return {
    clipLeft: Math.max(0, wa.x - b.x),
    clipRight: Math.max(0, b.x + b.width - (wa.x + wa.width)),
  };
});

ipcMain.handle("data-load", () => {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), "utf8"));
  } catch {
    return null;
  }
});

ipcMain.on("data-save", (_e, data) => {
  try {
    fs.writeFileSync(dataFile(), JSON.stringify(data, null, 2));
  } catch {}
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

app.whenReady().then(() => {
  createWindow();
  createTray();
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
