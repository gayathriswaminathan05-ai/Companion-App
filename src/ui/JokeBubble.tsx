import { useState } from "react";
import { SpeechBubble } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MicButton from "./MicButton";
import { stopSpeaking } from "../voice";

// Answers are ephemeral: typing and local dictation never enter saved chat data.
export default function JokeBubble({ setup, punchline, revealed, onReveal, onDismiss, preview = false }: {
  setup: string; punchline: string; revealed: boolean;
  onReveal: () => void; onDismiss: () => void; preview?: boolean;
}) {
  const [guess, setGuess] = useState("");
  const [answer, setAnswer] = useState("");
  const [micError, setMicError] = useState("");
  const [recording, setRecording] = useState(false);
  return (
    <SpeechBubble role="status">
      {preview && <p className="mb-2 text-xs font-medium text-muted-foreground">Test preview · nothing is saved</p>}
      {revealed ? <>
        {answer && <p className="mb-2 break-words text-xs text-muted-foreground">Your guess: {answer}</p>}
        <p className="leading-relaxed">{punchline}</p>
        <Button className="mt-3 w-full" onClick={onDismiss}>Haha</Button>
      </> : <>
        <p className="leading-relaxed">{setup}</p>
        <form className="mt-3" onSubmit={e => {
          e.preventDefault();
          if (!guess.trim() || recording) return;
          setAnswer(guess.trim());
          onReveal();
        }}>
          <label htmlFor="joke-guess" className="mb-1 block text-xs text-muted-foreground">Your guess</label>
          <div className="flex items-center gap-1.5">
            <Input id="joke-guess" value={guess} maxLength={200} onChange={e => setGuess(e.target.value)} placeholder="Take a guess…" className="min-w-0 flex-1" />
            <MicButton current={guess} onTranscript={text => setGuess(text.slice(0, 200))} onError={setMicError}
              onRecordingChange={setRecording} onStart={stopSpeaking} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Hold the mic to speak, then tap Answer.</p>
          {micError && <p role="alert" className="mt-1 text-xs text-destructive">{micError}</p>}
          <div className="mt-2 flex gap-1.5">
            <Button type="submit" className="flex-1" disabled={!guess.trim() || recording}>Answer</Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={onReveal}>What?</Button>
          </div>
          <Button type="button" variant="ghost" className="mt-1 w-full" onClick={onDismiss}>Not now</Button>
        </form>
      </>}
    </SpeechBubble>
  );
}
