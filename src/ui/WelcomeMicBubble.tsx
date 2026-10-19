import { useState } from "react";
import { SpeechBubble } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { stopSpeaking } from "../voice";

export default function WelcomeMicBubble({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<"intro" | "requesting" | "denied">("intro");
  const enable = async () => {
    if (phase === "requesting") return;
    stopSpeaking();
    setPhase("requesting");
    try {
      if (await window.companion.ensureMic() === true) { onFinish(); return; }
    } catch { /* Keep the explanation dismissible if macOS refuses. */ }
    setPhase("denied");
  };
  return (
    <SpeechBubble role="dialog" aria-label="Welcome and microphone setup">
      <p className="font-semibold">Hi! I'm your little desk plant.</p>
      <p className="mt-2 leading-relaxed">Tap me for tasks, breathing and settings.</p>
      {phase === "denied" ? <>
        <p className="mt-2 text-xs leading-relaxed">Microphone access is off. You can still type. To use voice later, allow Companion in Mac System Settings → Privacy & Security → Microphone.</p>
        <Button className="mt-3 w-full" onClick={onFinish}>Continue with typing</Button>
      </> : <>
        <p className="mt-2 leading-relaxed">Want to dictate tasks and answer my jokes aloud?</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">I only listen while you hold the mic. Your voice is turned into text on your Mac.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button className="flex-1" disabled={phase === "requesting"} onClick={() => void enable()}>{phase === "requesting" ? "Waiting for macOS…" : "Enable microphone"}</Button>
          <Button variant="secondary" disabled={phase === "requesting"} onClick={onFinish}>Not now</Button>
        </div>
      </>}
    </SpeechBubble>
  );
}
