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
  onError,
  onStart,
  bare = false,
  variant = "default",
}: {
  current: string;
  onTranscript: (t: string) => void;
  onSpeaking?: (speaking: boolean) => void;
  onRecordingChange?: (recording: boolean) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  bare?: boolean; // borderless style for use inside an input field
  variant?: "default" | "chat"; // chat = Figma circular lavender mic
}) {
  const [phase, setPhase] = useState<"idle" | "starting" | "rec" | "busy">("idle");
  const heldRef = useRef(false);
  const startingRef = useRef(false);
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
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      heldRef.current = false;
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
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
            if (text === null && !cancelledRef.current) {
              onError?.("I couldn't turn that recording into text. Please try again.");
            }
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
      } catch {
        if (!cancelledRef.current) onError?.("I couldn't turn that recording into text. Please try again.");
      }
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
    if (phase !== "idle" || startingRef.current) return;
    heldRef.current = true;
    startingRef.current = true;
    onStart?.();
    setPhase("starting");
    onError?.("");
    try {
      const ok = (await window.companion.ensureMic?.()) as boolean;
      if (ok === false) {
        onError?.("Allow microphone access in Mac System Settings → Privacy & Security → Microphone, then hold the mic again.");
        setPhase("idle");
        return;
      }
      if (!heldRef.current || cancelledRef.current) { setPhase("idle"); return; }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelledRef.current || !heldRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelledRef.current) setPhase("idle");
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
    } catch (error) {
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      onError?.(denied
        ? "Microphone access is blocked. Allow it in Mac System Settings, then hold the mic again."
        : "I couldn't open the microphone. Check your Mac's sound input, then try again.");
      setPhase("idle");
    } finally {
      startingRef.current = false;
    }
  };

  const stop = () => {
    if (heldRef.current && startingRef.current) {
      onError?.("Hold the microphone while you speak, then release to finish.");
    }
    heldRef.current = false;
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  };

  useEffect(() => {
    const release = () => {
      heldRef.current = false;
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (recRef.current?.state === "recording") recRef.current.stop();
    };
    window.addEventListener("mouseup", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("mouseup", release);
      window.removeEventListener("blur", release);
    };
  }, []);

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
        stop();
      }}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          void start();
        }
      }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") stop(); }}
      title={recording ? "listening, let go to finish" : "hold to talk"}
      aria-label="hold to talk"
      aria-pressed={recording}
      className={cn(
        buttonVariants({ variant: "secondary", size: "icon-sm" }),
        "size-7 rounded-full select-none hover:bg-bubble",
        recording && "animate-pulse bg-[#ffe1e1] text-[#e5484d] hover:bg-[#ffe1e1]",
      )}
    >
      {phase === "busy" || phase === "starting" ? <Spinner className="size-3.5" /> : <MicrophoneIcon weight={recording ? "fill" : "regular"} />}
    </button>
  );
}
