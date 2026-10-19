"use strict";
// Blob's speaking voice: Kokoro-82M text-to-speech running 100% on this Mac.
// Model files ship with the app. No text, audio or model request leaves it.
//
//   renderer (src/voice.ts) --ipc "voice-synthesize"--> main (this file)
//   main --> separate Electron utility process runs Kokoro --> Float32 PCM
//            back to the renderer, which plays it through WebAudio.
//   Why a separate PROCESS (not a worker thread): Kokoro bundles onnxruntime
//   1.21 while Whisper (main) uses 1.24. Two onnxruntime builds in one process
//   crashed in LoadModel (SIGSEGV). Separate processes never collide, the UI
//   never stutters, and quitting simply kills the voice process.
//
// The Kokoro code below is plain Node (no Electron needed) so it can be tested
// from a script; registerVoiceIpc() is the thin Electron wrapper.

const path = require("path");
const fs = require("fs");
const { createRequire } = require("module");


const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
// q8 = 92MB download, ~450MB RAM, ~2x faster than real time on an M2.
// "fp32" is ~2x faster again but 326MB and ~400MB more RAM (one-line swap).
const DTYPE = "q8";
const MODEL_FILE = "onnx/model_quantized.onnx"; // what dtype q8 loads
const DEFAULT_VOICE = "af_heart"; // warm, bright, friendly; Kokoro's best-rated voice
const DEFAULT_SPEED = 1.05;
const MAX_TEXT_CHARS = 2000; // hard safety cap per request
const MAX_CHUNK_CHARS = 280; // Kokoro handles ~510 phonemes per pass; stay well under

const errMsg = (err) => String((err && err.message) || err || "unknown error");

// ---------------------------------------------------------------------------
// Core (plain Node). One instance per thread: in the app it lives inside the
// worker thread; tests can call it directly.
// ---------------------------------------------------------------------------

const config = { cacheDir: null, bundledModelsDir: null };
const state = { loaded: false, loading: false, error: null, loadMs: null, primed: false };
let ttsPromise = null; // the single shared load; never load twice
let queue = Promise.resolve(); // serializes synthesis: one sentence at a time
let stateListener = null;

function configure({ cacheDir, bundledModelsDir } = {}) {
  if (cacheDir) config.cacheDir = cacheDir;
  if (bundledModelsDir) config.bundledModelsDir = bundledModelsDir;
}

function onStateChange(cb) {
  stateListener = cb;
}

function setState(patch) {
  Object.assign(state, patch);
  if (stateListener) stateListener(getStatus());
}

function getStatus() {
  return { loaded: state.loaded, loading: state.loading, error: state.error };
}

// kokoro-js ships its OWN copy of transformers.js (v3, nested in
// node_modules/kokoro-js/node_modules). The app's top-level v4 is Whisper's.
// Configure the exact instance kokoro-js requires, resolved from its folder.
function kokoroModules() {
  const entry = require.resolve("kokoro-js");
  const transformers = createRequire(entry)("@huggingface/transformers");
  return { entry, transformers };
}

function hasBundledModel() {
  const dir = config.bundledModelsDir;
  return !!dir && fs.existsSync(path.join(dir, MODEL_ID, MODEL_FILE));
}

function applyEnv(env) {
  // Download cache must be writable (a packaged app's own folder is not).
  if (config.cacheDir) {
    fs.mkdirSync(config.cacheDir, { recursive: true });
    env.cacheDir = config.cacheDir;
  }
  env.useFSCache = true;
  // A missing/incomplete bundled model must fail locally, never fetch online.
  if (config.bundledModelsDir) {
    env.localModelPath = config.bundledModelsDir;
    env.allowLocalModels = true;
  } else {
    env.allowLocalModels = false; // skip the pointless node_modules/models probe
  }
  env.allowRemoteModels = false;
}

async function loadOnce() {
  const { entry, transformers } = kokoroModules();
  applyEnv(transformers.env);
  const { KokoroTTS } = require(entry);
  return KokoroTTS.from_pretrained(MODEL_ID, { dtype: DTYPE, device: "cpu" });
}

// A download killed mid-write (app quit, laptop slept) leaves a truncated file
// that fails to parse forever. Wipe just this model's cache folder, retry once.
function looksCorrupt(err) {
  return /protobuf|parse|corrupt|invalid|unexpected end|json|failed to load model/i.test(errMsg(err));
}

function wipeCachedModel() {
  if (!config.cacheDir) return false;
  const dir = path.join(config.cacheDir, MODEL_ID);
  if (!fs.existsSync(dir)) return false;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function load() {
  if (ttsPromise) return ttsPromise;
  const t0 = Date.now();
  setState({ loading: true, error: null });
  ttsPromise = loadOnce()
    .catch((err) => {
      if (looksCorrupt(err) && wipeCachedModel()) return loadOnce();
      throw err;
    })
    .then(
      (tts) => {
        setState({ loaded: true, loading: false, error: null, loadMs: Date.now() - t0 });
        return tts;
      },
      (err) => {
        ttsPromise = null; // allow a later retry (e.g. was offline on first run)
        setState({ loaded: false, loading: false, error: errMsg(err) });
        throw err;
      },
    );
  return ttsPromise;
}

async function warmup() {
  const t0 = Date.now();
  try {
    await load();
    // The very first inference pays one-off setup costs; pay them now, quietly.
    if (!state.primed) {
      state.primed = true;
      await synthesize({ text: "Hi." });
    }
    return { ok: true, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

async function listVoices() {
  const tts = await load();
  return Object.keys(tts.voices);
}

// Split long text so each Kokoro pass stays under its phoneme limit.
function chunkText(text) {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text];
  const chunks = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) chunks.push(cur);
    cur = "";
  };
  for (let p of parts) {
    while (p.length > MAX_CHUNK_CHARS) {
      // One giant "sentence": break at the last comma/space that fits.
      const cut = Math.max(p.lastIndexOf(",", MAX_CHUNK_CHARS), p.lastIndexOf(" ", MAX_CHUNK_CHARS), 1);
      flush();
      chunks.push(p.slice(0, cut + 1));
      p = p.slice(cut + 1);
    }
    if ((cur + p).length > MAX_CHUNK_CHARS) flush();
    cur += p;
  }
  flush();
  return chunks.map((c) => c.trim()).filter(Boolean);
}

// Trim Kokoro's padding silence and add tiny fades so clips butt together
// cleanly; the renderer decides the pause between sentences.
function tidy(samples, sampleRate) {
  const thr = 0.003; // ~ -50 dBFS
  let a = 0;
  let b = samples.length;
  while (a < b && Math.abs(samples[a]) < thr) a++;
  while (b > a && Math.abs(samples[b - 1]) < thr) b--;
  if (a >= b) return new Float32Array(0);
  a = Math.max(0, a - Math.round(sampleRate * 0.012));
  b = Math.min(samples.length, b + Math.round(sampleRate * 0.05));
  const out = samples.slice(a, b); // a copy that owns its own buffer
  const fade = Math.min(Math.round(sampleRate * 0.004), out.length >> 1);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out[i] *= g;
    out[out.length - 1 - i] *= g;
  }
  return out;
}

async function synthesizeNow({ text, voice, speed } = {}) {
  const clean = typeof text === "string" ? text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS) : "";
  const tts = await load();
  const v = typeof voice === "string" && Object.prototype.hasOwnProperty.call(tts.voices, voice) ? voice : DEFAULT_VOICE;
  const s = Number.isFinite(speed) ? Math.min(2, Math.max(0.5, Number(speed))) : DEFAULT_SPEED;
  const t0 = Date.now();
  let sampleRate = 24000;
  const pieces = [];
  for (const chunk of clean ? chunkText(clean) : []) {
    const out = await tts.generate(chunk, { voice: v, speed: s });
    sampleRate = out.sampling_rate;
    pieces.push(tidy(out.audio, sampleRate));
  }
  const total = pieces.reduce((n, p) => n + p.length, 0);
  const pcm = new Float32Array(total);
  let off = 0;
  for (const p of pieces) {
    pcm.set(p, off);
    off += p.length;
  }
  return { sampleRate, pcm: pcm.buffer, voice: v, ms: Date.now() - t0 };
}

function synthesize(req) {
  const job = queue.then(() => synthesizeNow(req));
  queue = job.then(
    () => {},
    () => {},
  );
  return job;
}

const core = { configure, onStateChange, load, warmup, synthesize, listVoices, status: getStatus };

// ---------------------------------------------------------------------------
// Voice process entry: the same core, driven by messages from main.
// ---------------------------------------------------------------------------

function runChild() {
  configure(JSON.parse(process.env.COMPANION_VOICE_CONFIG || "{}"));
  const port = process.parentPort;
  onStateChange((st) => port.postMessage({ type: "state", state: st }));
  port.on("message", async (e) => {
    const { id, method, args } = (e && e.data) || {};
    try {
      let result;
      if (method === "warmup") result = await warmup();
      else if (method === "synthesize") result = await synthesize(args);
      else if (method === "voices") result = await listVoices();
      else throw new Error(`unknown voice method ${method}`);
      port.postMessage({ id, ok: true, result });
    } catch (err) {
      port.postMessage({ id, ok: false, error: errMsg(err) });
    }
  });
}

// Utility-process entry (spawned by createVoiceEngine below).
if (process.parentPort && process.env.COMPANION_VOICE_CHILD === "1") runChild();

// ---------------------------------------------------------------------------
// Engine used by main: worker-backed, falls back to in-process if a worker
// can't start (e.g. some packaged-app quirk), so Blob never goes mute.
// ---------------------------------------------------------------------------

function inProcessEngine(cfg) {
  configure(cfg);
  return {
    warmup: () => warmup(),
    synthesize: (req) => synthesize(req),
    voices: () => listVoices(),
    status: () => getStatus(),
    dispose: () => {},
    mode: "in-process",
  };
}

function createVoiceEngine({ cacheDir, bundledModelsDir, useWorker = true } = {}) {
  const cfg = { cacheDir, bundledModelsDir };
  if (!useWorker || process.env.COMPANION_VOICE_INPROCESS === "1") return inProcessEngine(cfg);

  let worker = null;
  let disposed = false;
  let everLoaded = false;
  let fallback = null;
  let nextId = 1;
  const pending = new Map(); // id -> { method, args, resolve, reject }
  let mirror = { loaded: false, loading: false, error: null };

  function useFallback(reason) {
    console.warn("voice: worker unavailable, running in-process:", reason);
    fallback = inProcessEngine(cfg);
    for (const p of pending.values()) fallback[p.method](p.args).then(p.resolve, p.reject);
    pending.clear();
  }

  function spawn() {
    const { utilityProcess } = require("electron");
    const child = utilityProcess.fork(__filename, [], {
      serviceName: "Companion Voice",
      stdio: "inherit",
      env: { ...process.env, COMPANION_VOICE_CHILD: "1", COMPANION_VOICE_CONFIG: JSON.stringify(cfg) },
    });
    child.on("message", (m) => {
      if (m && m.type === "state") {
        mirror = m.state;
        if (m.state.loaded) everLoaded = true;
        return;
      }
      const p = m && pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.ok) p.resolve(m.result);
      else p.reject(new Error(m.error));
    });
    child.on("exit", (code) => {
      if (worker !== child || disposed) return;
      worker = null;
      const err = new Error(`voice process exited (${code})`);
      mirror = { loaded: false, loading: false, error: errMsg(err) };
      if (!everLoaded) return useFallback(errMsg(err));
      for (const p of pending.values()) p.reject(err); // crashed after working: respawn on next call
      pending.clear();
    });
    return child;
  }

  function call(method, args) {
    if (disposed) return Promise.reject(new Error("voice engine disposed"));
    if (fallback) return fallback[method](args);
    if (!worker) {
      try {
        worker = spawn();
      } catch (err) {
        useFallback(errMsg(err));
        return fallback[method](args);
      }
    }
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { method, args, resolve, reject });
      worker.postMessage({ id, method, args });
    });
  }

  return {
    warmup: () => call("warmup").catch((err) => ({ ok: false, error: errMsg(err) })),
    synthesize: (req) => call("synthesize", req),
    voices: () => call("voices"),
    status: () => (fallback ? fallback.status() : { ...mirror }),
    dispose: () => {
      disposed = true;
      for (const p of pending.values()) p.reject(new Error("voice engine disposed"));
      pending.clear();
      if (worker) worker.kill(); // SIGTERM: the voice process just ends, no teardown
      worker = null;
    },
    get mode() {
      return fallback ? "in-process" : "process";
    },
  };
}

/**
 * Electron wiring. Call once from main after app is ready:
 *   registerVoiceIpc({ ipcMain, cacheDir: path.join(app.getPath("userData"), "models") })
 */
function registerVoiceIpc({ ipcMain, cacheDir, bundledModelsDir, useWorker, cloud } = {}) {
  const engine = createVoiceEngine({ cacheDir, bundledModelsDir, useWorker });
  ipcMain.handle("voice-warmup", () => engine.warmup());
  ipcMain.handle("voice-status", () => engine.status());
  ipcMain.handle("voice-synthesize", async (_e, req) => {
    try {
      const { text, voice, speed } = req || {};
      // Cloud voice first when asked (natural, accent per country); any
      // failure falls back to the on-device Kokoro voice.
      if (req && req.cloud && cloud && cloud.available()) {
        const c = await cloud.synthesize({ text, speed, ...req.cloud });
        if (c && c.pcm && c.pcm.byteLength) return c;
      }
      const out = await engine.synthesize({ text, voice, speed });
      return { sampleRate: out.sampleRate, pcm: out.pcm };
    } catch (err) {
      return { error: errMsg(err) };
    }
  });
  return engine;
}

module.exports = {
  registerVoiceIpc,
  createVoiceEngine,
  core,
  MODEL_ID,
  DTYPE,
  DEFAULT_VOICE,
  DEFAULT_SPEED,
};
