import { useEffect, useRef, useState } from "react";

// Press-and-HOLD to record (like walkie-talkie). Live transcription updates
// the field while held; releasing finishes. Fully offline (local Whisper).

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
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_SECONDS = 30;

export default function MicButton({
  current,
  onTranscript,
  onSpeaking,
  onRecordingChange,
  bare = false,
  variant = "default",
}: {
  current: string;
  onTranscript: (t: string) => void;
  onSpeaking?: (speaking: boolean) => void;
  onRecordingChange?: (recording: boolean) => void;
  bare?: boolean; // borderless style for use inside an input field
  variant?: "default" | "chat"; // chat = Figma circular lavender mic
}) {
  const [phase, setPhase] = useState<"idle" | "rec" | "busy">("idle");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const baseRef = useRef("");
  const busyRef = useRef(false);
  const pendingRef = useRef(false);
  const stoppedRef = useRef(false);
  const cancelledRef = useRef(false);
  const autoStopRef = useRef<number | null>(null);
  const currentRef = useRef(current);
  const lastEmittedRef = useRef("");
  currentRef.current = current;

  useEffect(() => {
    onRecordingChange?.(phase === "rec");
    return () => {
      if (phase === "rec") onRecordingChange?.(false);
    };
  }, [phase, onRecordingChange]);

  // Unmounting (e.g. panel closed or message sent) cancels everything:
  // any in-flight transcription is discarded, never re-filling the field.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      try {
        recRef.current?.stop();
      } catch {}
      vadCleanup.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compose = (hyp: string) => (baseRef.current ? `${baseRef.current} ${hyp}` : hyp);

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
        if (chunks.current.length > 0 && !cancelledRef.current) {
          const audio = await toFloat32Mono16k(new Blob(chunks.current));
          if (audio.length >= 4800) {
            const text = (await window.companion.transcribe(
              audio.buffer as ArrayBuffer,
            )) as string | null;
            const hyp = text ? cleanText(text) : "";
            const untouched =
              lastEmittedRef.current === "" || currentRef.current === lastEmittedRef.current;
            if (hyp && !cancelledRef.current && (!isFinal || untouched)) {
              const full = compose(hyp);
              onTranscript(full);
              lastEmittedRef.current = full;
            }
          }
        }
      } catch {}
    } while (pendingRef.current && !cancelledRef.current);
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
    if (phase !== "idle") return;
    try {
      const ok = (await window.companion.ensureMic?.()) as boolean;
      if (ok === false) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      startVad(stream);
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      chunks.current = [];
      baseRef.current = current.trim();
      stoppedRef.current = false;
      lastEmittedRef.current = "";
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
        if (!cancelledRef.current) void runPass();
      };
      rec.onstop = () => {
        vadCleanup.current?.();
        stream.getTracks().forEach((t) => t.stop());
        stoppedRef.current = true;
        if (cancelledRef.current || (chunks.current.length === 0 && !busyRef.current)) {
          setPhase("idle");
        } else {
          setPhase("busy");
          void runPass();
        }
      };
      rec.start(1400);
      setPhase("rec");
      autoStopRef.current = window.setTimeout(() => stop(), MAX_SECONDS * 1000);
    } catch {
      setPhase("idle");
    }
  };

  const stop = () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  };

  const chat = variant === "chat";
  const recording = phase === "rec";

  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        void start();
      }}
      onMouseUp={stop}
      onMouseLeave={() => {
        if (phase === "rec") stop();
      }}
      title="hold to talk"
      style={
        chat
          ? {
              width: 22,
              height: 22,
              minWidth: 22,
              padding: 0,
              border: "none",
              borderRadius: 22,
              background: recording ? "#FFE1E1" : phase === "busy" ? "#f5f3ff" : "#f5f3ff",
              color: recording ? "#E5484D" : "#6A53E7",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease",
              boxShadow: recording ? "0 0 0 3px rgba(229, 72, 77, 0.22)" : "0 0 0 0 rgba(229, 72, 77, 0)",
              transform: recording ? "scale(1.06)" : "scale(1)",
              animation: recording ? "micpulse 1.2s ease-in-out infinite" : undefined,
              userSelect: "none",
              flexShrink: 0,
            }
          : {
              width: bare ? 28 : 34,
              height: bare ? 26 : undefined,
              padding: bare ? 0 : "5px 0",
              border: bare ? "none" : `1px solid ${recording ? "#f0a89e" : "#d8c9ac"}`,
              borderRadius: bare ? 6 : 8,
              background: recording ? "#ffd9d4" : bare ? "transparent" : "#fffdf7",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              animation: recording ? "micpulse 1.2s ease-in-out infinite" : undefined,
              userSelect: "none",
            }
      }
    >
      {chat ? (
        phase === "busy" ? (
          <span style={{ fontSize: 10, color: "#6A53E7", lineHeight: 1 }}>…</span>
        ) : (
          <MicGlyph />
        )
      ) : recording ? (
        "🔴"
      ) : phase === "busy" ? (
        "…"
      ) : (
        "🎤"
      )}
      <style>{`
        @keyframes micpulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(229, 72, 77, 0.45); }
          50% { box-shadow: 0 0 0 6px rgba(229, 72, 77, 0); }
        }
      `}</style>
    </button>
  );
}

function MicGlyph() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 10.0465 12.2"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", pointerEvents: "none", transition: "color 0.2s ease" }}
      aria-hidden
    >
      <path
        d="M5.02294 9.53848C5.1472 9.53848 5.26709 9.58734 5.35497 9.6752C5.44285 9.76308 5.49169 9.88294 5.49169 10.0072V11.6811C5.49169 11.8053 5.44284 11.9252 5.35497 12.0131C5.26709 12.101 5.14722 12.1498 5.02294 12.1498C4.89884 12.1497 4.77967 12.1008 4.69188 12.0131C4.604 11.9252 4.55419 11.8053 4.55419 11.6811V10.0072C4.55419 9.88294 4.604 9.76308 4.69188 9.6752C4.77967 9.58752 4.89887 9.53856 5.02294 9.53848ZM5.02294 0.0501953C5.88721 0.0501953 6.71642 0.393258 7.32762 1.0043C7.93879 1.61546 8.28262 2.44468 8.2827 3.30898V5.54238C8.28153 6.40627 7.9375 7.23423 7.32665 7.84512C6.71565 8.45612 5.88702 8.80012 5.02294 8.80117C4.159 8.80005 3.33113 8.45599 2.7202 7.84512C2.10931 7.23423 1.76532 6.4063 1.76415 5.54238V3.30898C1.76423 2.44468 2.10709 1.61546 2.71825 1.0043C3.32941 0.393134 4.15863 0.0502796 5.02294 0.0501953ZM5.02294 0.987695C4.40742 0.988518 3.81755 1.23312 3.38231 1.66836C2.94707 2.1036 2.70247 2.69347 2.70165 3.30898V5.54141C2.70165 6.15726 2.94586 6.74851 3.38133 7.18398C3.81673 7.61932 4.40724 7.86359 5.02294 7.86367C5.63879 7.86367 6.23004 7.61946 6.66551 7.18398C7.10095 6.74851 7.3452 6.15723 7.3452 5.54141V3.30898C7.34438 2.69355 7.09967 2.10359 6.66454 1.66836C6.22921 1.23303 5.63859 0.988418 5.02294 0.987695Z"
        fill="currentColor"
      />
      <path
        d="M9.48817 5.05395C9.61769 5.05395 9.74228 5.10494 9.83387 5.19653C9.92542 5.28811 9.97645 5.41274 9.97645 5.54223C9.97488 6.8554 9.45286 8.11465 8.5243 9.04321C7.65363 9.91381 6.49237 10.4276 5.26844 10.4895L5.02332 10.4954C3.71015 10.4939 2.45095 9.9717 1.52235 9.04321C0.593789 8.11465 0.0717664 6.8554 0.0701991 5.54223C0.0701991 5.41271 0.12119 5.28811 0.212777 5.19653C0.304365 5.10494 0.428956 5.05395 0.55848 5.05395C0.687812 5.05404 0.811714 5.10511 0.903207 5.19653C0.994794 5.28811 1.04676 5.41271 1.04676 5.54223C1.04685 6.59667 1.4653 7.60808 2.21082 8.35375C2.95661 9.09954 3.96863 9.51879 5.02332 9.51879C6.07793 9.51877 7.08909 9.09944 7.83485 8.35375C8.58055 7.60805 8.9998 6.59681 8.99989 5.54223C8.99989 5.41271 9.05185 5.28811 9.14344 5.19653C9.23496 5.10512 9.35882 5.054 9.48817 5.05395Z"
        fill="currentColor"
      />
    </svg>
  );
}
