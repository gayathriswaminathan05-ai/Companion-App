import { useEffect, useRef, useState } from "react";
import { Panel, PanelHeader } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { BREATHING_DURATION_MS, breathingStep } from "../breathing";
import MeditationWaves from "./MeditationWaves";

export default function BreathingPanel({ onClose, onActiveChange, onComplete, interrupted = false, voiceOn = true, waveSpeed = "flowing" }: {
  onClose: () => void;
  onActiveChange: (active: boolean) => void;
  onComplete: () => void;
  interrupted?: boolean;
  voiceOn?: boolean;
  waveSpeed?: "flowing" | "slow";
}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [ownPace, setOwnPace] = useState(false);
  const [guideOn, setGuideOn] = useState(true);
  const voiceStyle = "v2";
  const [minutes, setMinutes] = useState(1);
  const duration = minutes * BREATHING_DURATION_MS;
  const suffix = minutes === 1 ? "" : `-${minutes}m`;
  const [musicOn, setMusicOn] = useState(true);
  const [musicVolume, setMusicVolume] = useState(25);
  const [musicError, setMusicError] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [pauseNote, setPauseNote] = useState("");
  const elapsedRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const activeCallback = useRef(onActiveChange);
  const completeCallback = useRef(onComplete);
  activeCallback.current = onActiveChange;
  completeCallback.current = onComplete;
  const step = breathingStep(elapsed, duration);
  const done = step.phase === "done";

  useEffect(() => { activeCallback.current(running); }, [running]);
  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = musicVolume / 100;
  }, [musicVolume, minutes]);
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
      const next = Math.min(duration, audio.currentTime * 1000);
      if (music && !music.paused && Math.abs(music.currentTime - audio.currentTime) > 0.3) music.currentTime = audio.currentTime;
      elapsedRef.current = next;
      setElapsed(next);
      if (next === duration || audio.ended) {
        clearInterval(timer);
        elapsedRef.current = duration;
        setElapsed(duration);
        setRunning(false);
        completeCallback.current();
      }
    }, 100);
    return () => { cancelled = true; clearInterval(timer); audio.pause(); music?.pause(); };
  }, [running, ownPace, voiceStyle, duration]);

  const start = () => {
    if (interrupted) return;
    if (done) { elapsedRef.current = 0; setElapsed(0); }
    setPauseNote("");
    setRunning(true);
  };
  const pause = () => { audioRef.current?.pause(); musicRef.current?.pause(); setRunning(false); setPreparing(false); };
  const close = () => { audioRef.current?.pause(); musicRef.current?.pause(); onClose(); };
  return (
    <Panel>
      <audio data-meditation="voice" ref={audioRef} src={`${import.meta.env.BASE_URL}audio/meditation-${ownPace ? "ownPace" : "guided"}-${voiceStyle}${suffix}.m4a`} preload="auto" muted={!voiceOn || !guideOn} />
      <audio data-meditation="music" ref={musicRef} src={`${import.meta.env.BASE_URL}audio/meditation-music-v1${suffix}.m4a`} preload="auto" muted={!musicOn} />
      <style>{`.meditation-volume { appearance: none; border-radius: 4px; background: color-mix(in srgb, currentColor 20%, transparent); } .meditation-volume::-webkit-slider-thumb { appearance: none; width: 9px; height: 9px; border-radius: 50%; background: currentColor; }`}</style>
      <PanelHeader title="Breathe with me" onClose={close} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto text-center">
        <div className="relative min-h-[100px] flex-1">
          <MeditationWaves speed={waveSpeed} playing={running && !preparing && !ownPace} />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1 px-4 pb-1">
        <p className="text-xs font-medium" role="status" aria-live="polite">{done ? "A little room for you." : running ? preparing ? "Getting ready…" : ownPace ? "Your breath. Your rhythm." : step.label : elapsed > 0 ? "Paused. Take your time." : "A little pause, just for you."}</p>
        <div className="flex w-full items-center justify-between gap-3 pt-1">
        <p className="text-[25px] leading-none font-normal tabular-nums tracking-tight" aria-label="Time remaining">{Math.floor(step.remaining / 60)}:{String(step.remaining % 60).padStart(2, "0")}</p>
        <div className="flex gap-1" role="group" aria-label="Meditation duration">
          {[1,3,5].map(value => <button key={value} type="button" disabled={running} aria-pressed={minutes === value} onClick={() => { setMinutes(value); elapsedRef.current=0; setElapsed(0); setPauseNote(""); }} className={`rounded-full px-3 py-1 text-[11px] transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-primary ${minutes === value ? "bg-primary/10 text-primary dark:text-[#c5b9ff]" : "text-muted-foreground"}`}>{value} min</button>)}
        </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-1 text-[11px] text-muted-foreground">
          <label className="flex items-center gap-1.5"><input className="size-3 appearance-none rounded-full border border-muted-foreground/50 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40" type="checkbox" checked={ownPace} disabled={running} onChange={e => setOwnPace(e.target.checked)} />My own pace</label>
          <label className="flex items-center gap-1.5"><input className="size-3 appearance-none rounded-full border border-muted-foreground/50 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40" type="checkbox" checked={voiceOn && guideOn} disabled={!voiceOn} onChange={e => setGuideOn(e.target.checked)} />Voice</label>
          <label className="flex items-center gap-1.5"><input className="size-3 appearance-none rounded-full border border-muted-foreground/50 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40" type="checkbox" checked={musicOn} onChange={e => setMusicOn(e.target.checked)} />Music</label>
          {musicOn && <input aria-label="Music volume" type="range" min="0" max="100" value={musicVolume} onChange={e => setMusicVolume(Number(e.target.value))} className="meditation-volume h-1 w-12 accent-primary" />}
        </div>
        <p className="text-[10px] text-muted-foreground">Breathe comfortably. Stop if you feel uncomfortable.</p>
        {!voiceOn && <p className="text-[11px] text-muted-foreground">Turn on voice in Settings to hear your guide.</p>}
        {musicError && <p role="status" className="text-[11px] text-muted-foreground">Music couldn't play. Your guide can continue.</p>}
        {pauseNote && !running && !done && <p role="status" className="text-[11px] text-muted-foreground">{pauseNote}</p>}
        {interrupted && !running && <p role="status" className="text-[11px] text-muted-foreground">Dismiss the active reminder or activity to start.</p>}
        </div>
      </div>
      <div className="flex shrink-0 justify-center gap-2 px-4 pb-3 pt-1">
        {running ? <Button size="sm" variant="secondary" onClick={pause}>Pause</Button> : <Button size="sm" disabled={interrupted} onClick={start}>{done ? "Start again" : elapsed > 0 ? "Resume" : "Start"}</Button>}
        <Button size="sm" variant="ghost" onClick={close}>{done ? "Done" : "Stop"}</Button>
      </div>
    </Panel>
  );
}
