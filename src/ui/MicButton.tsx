import { useEffect, useRef, useState } from "react";
import { MicrophoneIcon } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

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

  // `bare` / `variant` kept for call-site compatibility; every mic shares one
  // look (shadcn ghost icon button; red pulse while recording).
  void bare;
  void variant;
  const recording = phase === "rec";

  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        void start();
      }}
      onMouseUp={stop}
      onMouseLeave={() => {
        if (phase === "rec") stop();
      }}
      title={recording ? "listening, let go to finish" : "hold to talk"}
      aria-label="hold to talk"
      aria-pressed={recording}
      className={cn(
        buttonVariants({ variant: "secondary", size: "icon-sm" }),
        "size-7 rounded-full select-none hover:bg-bubble",
        recording && "animate-pulse bg-[#ffe1e1] text-[#e5484d] hover:bg-[#ffe1e1]",
      )}
    >
      {phase === "busy" ? <Spinner className="size-3.5" /> : <MicrophoneIcon weight={recording ? "fill" : "regular"} />}
    </button>
  );
}
