import { useRef, useState } from "react";
import { smallBtn } from "./theme";

// Live dictation: while recording, the growing audio is re-transcribed every
// ~1.5s and the field updates with the best-so-far text. Fully offline.

async function toFloat32Mono16k(blob: Blob): Promise<Float32Array> {
  const raw = await blob.arrayBuffer();
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(raw);
  await ctx.close();
  const target = Math.ceil(decoded.duration * 16000);
  const off = new OfflineAudioContext(1, target, 16000);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return rendered.getChannelData(0).slice();
}

function cleanText(t: string): string {
  return t
    .replace(/\[[^\]]*\]/g, "") // [BLANK_AUDIO] etc.
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_SECONDS = 30;

export default function MicButton({
  current,
  onTranscript,
  onPhase,
  onSpeaking,
}: {
  current: string;
  onTranscript: (t: string) => void;
  onPhase?: (phase: "idle" | "rec" | "busy") => void;
  // Fires true while actual voice is detected, false in pauses (local VAD).
  onSpeaking?: (speaking: boolean) => void;
}) {
  const [phase, setPhaseRaw] = useState<"idle" | "rec" | "busy">("idle");
  const setPhase = (p: "idle" | "rec" | "busy") => {
    setPhaseRaw(p);
    onPhase?.(p);
  };
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const baseRef = useRef("");
  const busyRef = useRef(false);
  const pendingRef = useRef(false);
  const stoppedRef = useRef(false);
  const autoStopRef = useRef<number | null>(null);
  const currentRef = useRef(current);
  const lastEmittedRef = useRef("");
  currentRef.current = current;

  const compose = (hyp: string) =>
    baseRef.current ? `${baseRef.current} ${hyp}` : hyp;

  const runPass = async () => {
    if (busyRef.current) {
      pendingRef.current = true;
      return;
    }
    busyRef.current = true;
    do {
      pendingRef.current = false;
      const isFinal = stoppedRef.current;
      try {
        if (chunks.current.length > 0) {
          const audio = await toFloat32Mono16k(new Blob(chunks.current));
          if (audio.length >= 4800) {
            const text = (await window.companion.transcribe(
              audio.buffer as ArrayBuffer,
            )) as string | null;
            const hyp = text ? cleanText(text) : "";
            // Don't overwrite the field if the user edited/cleared it after
            // our last update (e.g. they already submitted the task).
            const untouched =
              lastEmittedRef.current === "" ||
              currentRef.current === lastEmittedRef.current;
            if (hyp && (!isFinal || untouched)) {
              const full = compose(hyp);
              onTranscript(full);
              lastEmittedRef.current = full;
            }
          }
        }
      } catch {
        // keep quiet; typing still works
      }
    } while (pendingRef.current);
    busyRef.current = false;
    if (stoppedRef.current) setPhase("idle");
  };

  const vadCleanup = useRef<(() => void) | null>(null);

  const startVad = (stream: MediaStream) => {
    const actx = new AudioContext();
    const src = actx.createMediaStreamSource(stream);
    const analyser = actx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let lastVoice = 0;
    let wasSpeaking = false;
    const id = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (rms > 0.015) lastVoice = now;
      const speaking = now - lastVoice < 650;
      if (speaking !== wasSpeaking) {
        wasSpeaking = speaking;
        onSpeaking?.(speaking);
      }
    }, 100);
    vadCleanup.current = () => {
      clearInterval(id);
      actx.close().catch(() => {});
      onSpeaking?.(false);
      vadCleanup.current = null;
    };
  };

  const start = async () => {
    try {
      const ok = (await window.companion.ensureMic?.()) as boolean;
      if (ok === false) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startVad(stream);
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      chunks.current = [];
      baseRef.current = current.trim();
      stoppedRef.current = false;
      lastEmittedRef.current = "";
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
        void runPass();
      };
      rec.onstop = () => {
        vadCleanup.current?.();
        stream.getTracks().forEach((t) => t.stop());
        stoppedRef.current = true;
        if (chunks.current.length === 0 && !busyRef.current) {
          setPhase("idle");
        } else {
          setPhase("busy");
          void runPass();
        }
      };
      rec.start(1400); // emit a chunk every 1.4s -> live updates
      setPhase("rec");
      autoStopRef.current = window.setTimeout(() => stop(), MAX_SECONDS * 1000);
    } catch {
      setPhase("idle");
    }
  };

  const stop = () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    recRef.current?.stop();
  };

  return (
    <button
      style={{
        ...smallBtn,
        width: 34,
        padding: "5px 0",
        background: phase === "rec" ? "#ffd9d4" : (smallBtn.background as string),
        borderColor: phase === "rec" ? "#f0a89e" : "#d8c9ac",
        animation: phase === "rec" ? "micpulse 1.2s ease-in-out infinite" : undefined,
      }}
      title={phase === "rec" ? "tap to finish" : "speak instead of typing"}
      onClick={phase === "rec" ? stop : phase === "idle" ? start : undefined}
    >
      {phase === "rec" ? "🔴" : phase === "busy" ? "…" : "🎤"}
      <style>{`
        @keyframes micpulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(240, 138, 122, 0.5); }
          50% { box-shadow: 0 0 0 5px rgba(240, 138, 122, 0); }
        }
      `}</style>
    </button>
  );
}
