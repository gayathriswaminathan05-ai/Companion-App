// Blob's speaking voice (renderer side).
// Text → cleaned for speech → split into sentences → each synthesized locally
// by Kokoro in the main process (electron/voice.cjs) → played back-to-back
// through one AudioContext. Nothing leaves the device.

/** No pitch tint: speeding playback up made the voice sound robotic (owner
 *  feedback). Character comes from the voice + speed chosen in main. */
const PLAYBACK_RATE = 1.0;
/** Never read more than this aloud (cut at a sentence boundary). */
const MAX_SPOKEN_CHARS = 600;
/** Breath between sentences (Kokoro's own edge silence is trimmed in main). */
const SENTENCE_GAP_S = 0.16;
/** Small lead so the first buffer never starts in the past (avoids a click). */
const START_LEAD_S = 0.03;
/** Output level; Kokoro peaks close to full scale. */
const VOLUME = 0.9;
/** Fragments shorter than this ("hey!", "WAIT.") ride along with the next sentence. */
const MIN_CHUNK_CHARS = 14;
/** Sentences are synthesized together (up to these lengths) so Kokoro keeps a
 *  natural sentence-to-sentence melody instead of choppy one-liners. The first
 *  chunk stays shorter so Blob starts talking quickly. */
const FIRST_CHUNK_MAX = 110;
const CHUNK_MAX = 230;

type SynthResult = { sampleRate: number; pcm: ArrayBuffer } | { error: string };
type VoiceStatus = { loaded: boolean; loading: boolean; error: string | null };

/** The slice of the preload bridge this module uses (see electron/preload.cjs). */
interface VoiceBridge {
  voiceSynthesize?: (req: { text: string; voice?: string; speed?: number; cloud?: CloudVoice | null }) => Promise<SynthResult>;
  voiceWarmup?: () => Promise<{ ok: boolean; ms?: number; error?: string }>;
  voiceStatus?: () => Promise<VoiceStatus>;
}

function bridge(): VoiceBridge | undefined {
  // Narrow cast: App.tsx owns the global `window.companion` type.
  return window.companion as unknown as VoiceBridge | undefined;
}

export type SpeakOptions = {
  /** Kokoro voice id, e.g. "af_heart" (default, chosen in main). */
  voice?: string;
  /** Speaking speed, 0.5–2 (main defaults to 1.05). */
  speed?: number;
  /** Stop whatever is already being said first (default true). false = queue after it. */
  interrupt?: boolean;
  /** Use the cloud voice (Google, accent per country). Falls back to on-device. */
  cloud?: CloudVoice | null;
};

export type CloudVoice = { languageCode: string; voiceName: string };

/** Accent from the Mac's region (e.g. "en-IN" → Indian English). */
export function accentForLocale(locale: string | undefined): string {
  const region = (locale || "").split(/[-_]/)[1]?.toUpperCase() || "";
  if (region === "IN") return "en-IN";
  if (region === "GB" || region === "IE") return "en-GB";
  if (region === "AU" || region === "NZ") return "en-AU";
  return "en-US";
}

/** Google Chirp 3 HD voices offered in Settings (same names in every accent). */
export const CLOUD_VOICES: { id: string; label: string }[] = [
  { id: "Puck", label: "Playful" },
  { id: "Fenrir", label: "Excited" },
  { id: "Charon", label: "Warm" },
  { id: "Leda", label: "Bright" },
  { id: "Aoede", label: "Breezy" },
  { id: "Zephyr", label: "Sunny" },
];

export const ACCENTS: { id: string; label: string }[] = [
  { id: "en-IN", label: "Indian English" },
  { id: "en-US", label: "American English" },
  { id: "en-GB", label: "British English" },
  { id: "en-AU", label: "Australian English" },
];

// ---------------------------------------------------------------------------
// Text → speakable sentences
// ---------------------------------------------------------------------------

const EMOJI_RE =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍︎️⃣]/gu;
const ENDS_SENTENCE_RE = /[.!?:;,]["'”’)\]]*$/;

/** Turn chat-style markdown / tagged text into plain words worth saying aloud. */
export function cleanForSpeech(raw: string): string {
  let t = raw
    .replace(/<([a-z][\w-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ") // <task ...>…</task>, <remember>…</remember>
    .replace(/<\/?[a-z][\w-]*\b[^>]*\/?>/gi, " ") // <tag/>, stray open/close tags
    .replace(/```[\s\S]*?```/g, " ") // code blocks
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt text
    .replace(/\[([^\]]+)\]\((?:[^()\s]|\([^)]*\))*\)/g, "$1") // [label](url) → label
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, " ") // bare URLs
    .replace(EMOJI_RE, " ");

  // Line by line: drop list/heading/quote markers; every line ends a sentence.
  t = t
    .split(/\n+/)
    .map((line) => {
      const l = line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, "")
        .trim();
      if (!/[\p{L}\p{N}]/u.test(l)) return "";
      return ENDS_SENTENCE_RE.test(l) ? l : `${l}.`;
    })
    .filter(Boolean)
    .join(" ");

  return t
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // bold
    .replace(/(^|[\s(])[*_]([^*_]+?)[*_](?=[\s).,!?:;]|$)/g, "$1$2") // italics
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/~~(.+?)~~/g, "$1") // strikethrough
    .replace(/[*_#`~|<>\\]+/g, " ") // leftover markdown symbols
    .replace(/…|\.{3,}/g, ".") // ellipses → a plain stop
    .replace(/(\p{L})\1{2,}/gu, "$1") // "STOPPP" / "sooo" → "STOP" / "so"
    .replace(/\s+/g, " ")
    .replace(/\s+([.!?,;:])/g, "$1")
    .replace(/([.!?])[.,;:]+/g, "$1") // "!." → "!"
    .trim();
}

const ABBREV_RE = /\b(?:mr|mrs|ms|dr|st|vs|etc|e\.g|i\.e|approx)\.$/i;

/** Split cleaned text into sentences (keeps decimals, times, "Dr. Smith" intact). */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const piece of text.split(/(?<=[.!?]["'”’)\]]*)\s+/)) {
    cur = cur ? `${cur} ${piece}` : piece;
    if (!ABBREV_RE.test(cur)) {
      out.push(cur);
      cur = "";
    }
  }
  if (cur) out.push(cur);
  return out.map((s) => s.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s));
}

/** Cleaned, capped, chunked text — exactly what Blob will say, in order. */
export function toSpeechChunks(raw: string): string[] {
  const sentences = splitSentences(cleanForSpeech(raw));

  // Cap total length at a sentence boundary.
  const capped: string[] = [];
  let total = 0;
  for (const s of sentences) {
    if (total + s.length > MAX_SPOKEN_CHARS) {
      if (!capped.length) {
        const cut = s.lastIndexOf(" ", MAX_SPOKEN_CHARS);
        capped.push(`${s.slice(0, cut > 0 ? cut : MAX_SPOKEN_CHARS).replace(/[,;:\s]+$/, "")}.`);
      }
      break;
    }
    capped.push(s);
    total += s.length + 1;
  }

  // Tiny fragments sound clipped on their own; glue them to the next one.
  const chunks: string[] = [];
  for (const s of capped) {
    const prev = chunks[chunks.length - 1];
    if (prev !== undefined && prev.length < MIN_CHUNK_CHARS) chunks[chunks.length - 1] = `${prev} ${s}`;
    else chunks.push(s);
  }

  // Group neighbouring sentences so the voice flows like speech.
  const grouped: string[] = [];
  for (const s of chunks) {
    const i = grouped.length - 1;
    const limit = i === 0 ? FIRST_CHUNK_MAX : CHUNK_MAX;
    if (i >= 0 && grouped[i].length + 1 + s.length <= limit) grouped[i] = `${grouped[i]} ${s}`;
    else grouped.push(s);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

let enabled = true;
let session = 0; // bumped by stopSpeaking(); stale synthesis results are dropped
let chain: Promise<unknown> = Promise.resolve(); // one utterance synthesizes at a time
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let nextStartAt = 0;
let producing = 0; // utterances still synthesizing
let hadAudio = false;
let speaking = false;
const live = new Set<AudioBufferSourceNode>();
const stopWaiters = new Set<() => void>();
const listeners = new Set<(speaking: boolean) => void>();

function audio(): { ac: AudioContext; gain: GainNode } {
  if (!ctx || !out) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    out = ctx.createGain();
    out.gain.value = VOLUME;
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ac: ctx, gain: out };
}

function refreshSpeaking() {
  // Stay "speaking" across a between-sentence wait if more audio is coming.
  const now = live.size > 0 || (producing > 0 && hadAudio);
  if (!now) hadAudio = false;
  if (now === speaking) return;
  speaking = now;
  for (const cb of listeners) {
    try {
      cb(now);
    } catch (err) {
      console.error("voice listener failed", err);
    }
  }
}

function schedule(sampleRate: number, pcm: ArrayBuffer): AudioBufferSourceNode {
  const { ac, gain } = audio();
  const samples = new Float32Array(pcm);
  const buf = ac.createBuffer(1, samples.length, sampleRate);
  buf.copyToChannel(samples, 0);
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = PLAYBACK_RATE;
  src.connect(gain);
  const startAt = Math.max(nextStartAt, ac.currentTime + START_LEAD_S);
  src.start(startAt);
  nextStartAt = startAt + buf.duration / PLAYBACK_RATE + SENTENCE_GAP_S;
  live.add(src);
  src.onended = () => {
    live.delete(src);
    src.disconnect();
    refreshSpeaking();
  };
  hadAudio = true;
  refreshSpeaking();
  return src;
}

function untilEnded(src: AudioBufferSourceNode): Promise<void> {
  if (!live.has(src)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      stopWaiters.delete(done);
      resolve();
    };
    stopWaiters.add(done);
    src.addEventListener("ended", done, { once: true });
  });
}

async function produce(
  api: Required<Pick<VoiceBridge, "voiceSynthesize">>,
  chunks: string[],
  my: number,
  opts: SpeakOptions,
): Promise<AudioBufferSourceNode | null> {
  if (my !== session) return null;
  producing++;
  let last: AudioBufferSourceNode | null = null;
  try {
    for (const text of chunks) {
      if (my !== session) break;
      let res: SynthResult;
      try {
        res = await api.voiceSynthesize({ text, voice: opts.voice, speed: opts.speed, cloud: opts.cloud ?? null });
      } catch (err) {
        res = { error: String(err) };
      }
      if (my !== session) break;
      if ("error" in res) {
        console.warn("voice: couldn't say", JSON.stringify(text), res.error);
        continue;
      }
      if (res.pcm && res.pcm.byteLength > 0) last = schedule(res.sampleRate, res.pcm);
    }
  } finally {
    producing--;
    refreshSpeaking();
  }
  return my === session ? last : null;
}

/**
 * Say something out loud in Blob's voice. Resolves when it finishes playing
 * (or is stopped). Starts playing the first sentence while the rest synthesize.
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!enabled) return Promise.resolve();
  const api = bridge();
  const synth = api?.voiceSynthesize;
  if (!synth) return Promise.resolve();
  const chunks = toSpeechChunks(text);
  if (!chunks.length) return Promise.resolve();
  if (opts.interrupt !== false) stopSpeaking();
  const my = session;
  const run = chain.then(() => produce({ voiceSynthesize: synth.bind(api) }, chunks, my, opts));
  chain = run.catch(() => undefined);
  const finished = run.then(
    (last) => (last ? untilEnded(last) : undefined),
    () => undefined,
  );
  // Resolve the moment we're hushed, not when the in-flight sentence returns.
  let onStop = () => {};
  const stopped = new Promise<void>((resolve) => {
    onStop = resolve;
    stopWaiters.add(onStop);
  });
  return Promise.race([finished, stopped]).finally(() => stopWaiters.delete(onStop));
}

/** Hush now: drop pending sentences and cut the current one. */
export function stopSpeaking(): void {
  session++;
  for (const src of live) {
    src.onended = null;
    try {
      src.stop();
    } catch {
      // never started — nothing to stop
    }
    src.disconnect();
  }
  live.clear();
  nextStartAt = 0;
  hadAudio = false;
  for (const done of [...stopWaiters]) done();
  stopWaiters.clear();
  refreshSpeaking();
}

export function isSpeaking(): boolean {
  return speaking;
}

/** React to Blob starting/stopping talking (mouth, pose…). Returns unsubscribe. */
export function onSpeakingChange(cb: (speaking: boolean) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Global mute. Turning it off also hushes anything mid-sentence. */
export function setVoiceEnabled(on: boolean): void {
  enabled = on;
  if (!on) stopSpeaking();
}

export function voiceEnabled(): boolean {
  return enabled;
}

/** Load the voice model in the background so the first line isn't slow. */
export function warmUpVoice(): Promise<{ ok: boolean; ms?: number; error?: string }> {
  const api = bridge();
  if (!api?.voiceWarmup) return Promise.resolve({ ok: false, error: "voice bridge unavailable" });
  return api.voiceWarmup().catch((err: unknown) => ({ ok: false, error: String(err) }));
}

export function voiceStatus(): Promise<VoiceStatus> {
  const api = bridge();
  if (!api?.voiceStatus) return Promise.resolve({ loaded: false, loading: false, error: "voice bridge unavailable" });
  return api.voiceStatus();
}
