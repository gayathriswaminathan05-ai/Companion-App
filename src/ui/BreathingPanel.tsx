import { useEffect, useRef, useState } from "react";
import { Panel, PanelHeader } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { BREATHING_DURATION_MS, breathingStep } from "../breathing";
import MeditationReminderForm from "./MeditationReminderForm";

export default function BreathingPanel({ onClose, onActiveChange, onComplete, onScheduleReminder, interrupted = false, voiceOn = true }: {
  onClose: () => void;
  onActiveChange: (active: boolean) => void;
  onComplete: () => void;
  interrupted?: boolean;
  voiceOn?: boolean;
  onScheduleReminder?: (due: Date, recurring?: "daily") => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [ownPace, setOwnPace] = useState(false);
  const [guideOn, setGuideOn] = useState(true);
  const [voiceStyle, setVoiceStyle] = useState("v2");
  const [musicOn, setMusicOn] = useState(true);
  const [musicVolume, setMusicVolume] = useState(25);
  const [musicError, setMusicError] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderNote, setReminderNote] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [pauseNote, setPauseNote] = useState("");
  const elapsedRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const activeCallback = useRef(onActiveChange);
  const completeCallback = useRef(onComplete);
  activeCallback.current = onActiveChange;
  completeCallback.current = onComplete;
  const step = breathingStep(elapsed);
  const done = step.phase === "done";

  useEffect(() => { activeCallback.current(running); }, [running]);
  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = musicVolume / 100;
  }, [musicVolume, reminderOpen]);
  useEffect(() => {
    if (interrupted && running) {
      audioRef.current?.pause();
      musicRef.current?.pause();
      setRunning(false);
      setPauseNote("Paused for your reminder or other activity. Resume when you're ready.");
    }
  }, [interrupted, running]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        audioRef.current?.pause();
        musicRef.current?.pause();
        setRunning(false);
        setPauseNote("Paused while you were away. Resume when you're ready.");
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    const music = musicRef.current;
    if (!audio || !running) return;
    let cancelled = false;
    setPreparing(true);
    audio.currentTime = elapsedRef.current / 1000;
    if (music) music.currentTime = elapsedRef.current / 1000;
    void audio.play().then(() => {
      if (!cancelled) {
        setPreparing(false);
        setMusicError(false);
        if (music) {
          music.currentTime = audio.currentTime;
          void music.play().catch(() => { if (!cancelled) setMusicError(true); });
        }
      }
    }).catch(() => {
      if (cancelled) return;
      setPreparing(false);
      setRunning(false);
      setPauseNote("The voice guide couldn't play. Please try again.");
    });
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = now - previous;
      previous = now;
      // A suspended Mac must not silently complete a session during sleep.
      if (delta > 2000) {
        audio.pause();
        music?.pause();
        setRunning(false);
        setPauseNote("Paused while you were away. Resume when you're ready.");
        return;
      }
      // The recording is the clock: captions never run ahead of a loading or
      // paused voice. Muting only changes volume, so timing stays identical.
      const next = Math.min(BREATHING_DURATION_MS, audio.currentTime * 1000);
      if (music && !music.paused && Math.abs(music.currentTime - audio.currentTime) > 0.3) music.currentTime = audio.currentTime;
      elapsedRef.current = next;
      setElapsed(next);
      if (next === BREATHING_DURATION_MS || audio.ended) {
        clearInterval(timer);
        elapsedRef.current = BREATHING_DURATION_MS;
        setElapsed(BREATHING_DURATION_MS);
        setRunning(false);
        completeCallback.current();
      }
    }, 100);
    return () => { cancelled = true; clearInterval(timer); audio.pause(); music?.pause(); };
  }, [running, ownPace, voiceStyle]);

  const start = () => {
    if (interrupted) return;
    if (done) { elapsedRef.current = 0; setElapsed(0); }
    setPauseNote("");
    setRunning(true);
  };
  const pause = () => { audioRef.current?.pause(); musicRef.current?.pause(); setRunning(false); setPreparing(false); };
  const close = () => { audioRef.current?.pause(); musicRef.current?.pause(); onClose(); };
  const label = done ? step.label : running ? preparing ? "Getting your guide ready…" : (ownPace ? "Breathe naturally. Nothing to get right." : step.label) : elapsed > 0 ? "Take your time. We're paused." : voiceOn && guideOn ? "Press Start to hear your guide." : "Press Start for a quiet minute.";
  if (reminderOpen && onScheduleReminder) return <MeditationReminderForm
    onBack={() => setReminderOpen(false)}
    onSchedule={(due, recurring) => {
      onScheduleReminder(due, recurring);
      setReminderNote(recurring ? `Daily reminder set for ${due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Manage it in Tasks.` : `Reminder set for ${due.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Manage it in Tasks.`);
      setReminderOpen(false);
    }}
  />;
  return (
    <Panel>
      <audio data-meditation="voice" ref={audioRef} src={`${import.meta.env.BASE_URL}audio/meditation-${ownPace ? "ownPace" : "guided"}-${voiceStyle}.m4a`} preload="auto" muted={!voiceOn || !guideOn} />
      <audio data-meditation="music" ref={musicRef} src={`${import.meta.env.BASE_URL}audio/meditation-music-v1.m4a`} preload="auto" muted={!musicOn} />
      <PanelHeader title="Breathe with me" onClose={close}>
        {onScheduleReminder && <button type="button" onClick={() => { pause(); setReminderOpen(true); }} className="ml-auto shrink-0 text-[11px] text-primary underline underline-offset-2 dark:text-[#cbc1ff]">Set a reminder</button>}
      </PanelHeader>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto px-4 pb-2 text-center">
        <div className="relative mt-1 flex h-10 w-full shrink-0 items-center justify-center" aria-hidden="true">
          <div className="breathing-orb size-9 rounded-full bg-primary/15 ring-1 ring-primary/25" style={{ transform: running && !ownPace && step.phase === "in" ? "scale(1.28)" : "scale(1)" }} />
        </div>
        <p className="text-[14px] font-semibold" role="status" aria-live="polite">{label}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{done ? "A fresh moment, whenever you want one." : `${step.remaining}s · ${voiceOn && guideOn ? "voice guided" : musicOn ? "music only" : "quiet mode"} · on your Mac`}</p>
        <p className="max-w-[290px] text-[11px] text-muted-foreground">Follow only if comfortable. Breathe normally or stop if you feel dizzy or uncomfortable.</p>
        {!done && <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
          <label className="flex items-center gap-2" title={running ? "Pause to change breathing pace" : undefined}><input type="checkbox" checked={ownPace} disabled={running} onChange={e => setOwnPace(e.target.checked)} />My own pace</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={voiceOn && guideOn} disabled={!voiceOn} onChange={e => setGuideOn(e.target.checked)} />Voice guide</label>
        </div>}
        {!done && <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
          <select aria-label="Meditation voice" value={voiceStyle} disabled={running} onChange={e => setVoiceStyle(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-foreground disabled:opacity-60" title={running ? "Pause to change voice" : "Choose a meditation voice"}>
            <option value="v2">Soft voice</option><option value="v1">Original voice</option>
          </select>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={musicOn} onChange={e => setMusicOn(e.target.checked)} />Music</label>
          <input aria-label="Music volume" type="range" min="0" max="100" value={musicVolume} disabled={!musicOn} onChange={e => setMusicVolume(Number(e.target.value))} className="w-16 accent-primary" />
        </div>}
        {!voiceOn && <p className="text-[11px] text-muted-foreground">Voice is off in Settings. Turn it on to hear your guide.</p>}
        {musicError && <p className="text-[11px] text-muted-foreground">Music couldn't play. Your voice guide can still continue.</p>}
        {reminderNote && <p role="status" className="text-[11px] text-muted-foreground">{reminderNote}</p>}
        {pauseNote && !running && !done && <p className="text-[11px] text-muted-foreground">{pauseNote}</p>}
        {interrupted && !running && <p role="status" className="text-[11px] text-muted-foreground">Finish or dismiss the active reminder or activity first, then press Start.</p>}
      </div>
        <div className="flex shrink-0 justify-center gap-2 border-t border-border px-4 py-2">
          {running ? <Button size="sm" variant="secondary" onClick={pause}>Pause</Button> : <Button size="sm" disabled={interrupted} onClick={start}>{done ? "Another minute" : elapsed > 0 ? "Resume" : "Start one minute"}</Button>}
          <Button size="sm" variant="ghost" onClick={close}>{done ? "Done" : "Stop"}</Button>
        </div>
      <style>{`.breathing-orb { transition: transform 4s ease-in-out; } @media (prefers-reduced-motion: reduce) { .breathing-orb { transition: none; transform: none !important; } }`}</style>
    </Panel>
  );
}
