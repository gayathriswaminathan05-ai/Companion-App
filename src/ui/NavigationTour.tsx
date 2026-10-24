import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, BellIcon, CheckCircleIcon, MicrophoneIcon, PauseIcon, PlayIcon, WindIcon, MoonStarsIcon, GearSixIcon } from "@phosphor-icons/react";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import QuickNav from "./QuickNav";
import { TOUR_STEPS, type TourDestination, type TourStep } from "../navigationTour";

const COPY: Record<TourStep, { title: string; text: string }> = {
  tasks: { title: "Leave it with me.", text: "Tasks is home for your to-dos and reminders." },
  voice: { title: "Say it. I'll jot it down.", text: "In Tasks, hold the mic. Speak, then let go." },
  breathe: { title: "A tiny pocket of calm.", text: "Open Breathe for guided breathing and music." },
  jokes: { title: "I have terrible jokes.", text: "When I pop up with one, type or speak a guess." },
  settings: { title: "Make yourself at home.", text: "Settings holds your routine, voice and Calendar." },
};
export default function NavigationTour({ step, onStep, onFinish, busy, error, motionPaused, onToggleMotion }: {
  step: TourStep; onStep: (step: TourStep) => void;
  onFinish: (destination: TourDestination) => void; busy: boolean; error: string;
  motionPaused: boolean; onToggleMotion: () => void;
}) {
  const index = TOUR_STEPS.indexOf(step);
  const heading = useRef<HTMLHeadingElement>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { heading.current?.focus(); setRevealed(false); }, [step]);
  const active = step === "voice" ? "tasks" : step;
  return <Panel role="dialog" aria-label="A little tour" data-tour-step={step} className="rounded-[24px]">
    <div className="flex shrink-0 items-center justify-between px-5 pt-3 text-[11px] text-muted-foreground">
      <span>A little tour · {index + 1} of {TOUR_STEPS.length}</span>
      <Button variant="ghost" size="icon-sm" aria-label={motionPaused ? "Play plant animation" : "Pause plant animation"} onClick={onToggleMotion}>{motionPaused ? <PlayIcon /> : <PauseIcon />}</Button>
    </div>
    <div className="flex shrink-0 justify-center pt-1" aria-label="Menu shortcuts">
      <QuickNav items={[
        { icon: "tasks", label: "tasks", active: active === "tasks", onClick: () => !busy && onFinish("tasks") },
        { icon: "breathe", label: "breathe", active: active === "breathe", onClick: () => !busy && onFinish("breathe") },
        { icon: "settings", label: "settings", active: active === "settings", onClick: () => !busy && onFinish("settings") },
        { icon: "tuck", label: "nap", onClick: () => !busy && onFinish("nap") },
      ]} />
    </div>
    <div key={step} className="setup-step flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pt-3 pb-2">
      <div className="text-center">
        <h2 ref={heading} tabIndex={-1} className="text-[21px] leading-tight font-semibold tracking-tight outline-none">{COPY[step].title}</h2>
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{COPY[step].text}</p>
      </div>
      {step === "tasks" && <div className="rounded-xl border bg-card p-3 text-xs">
        <span className="text-[10px] text-muted-foreground">Example reminder</span>
        <div className="mt-2 flex items-center gap-2"><CheckCircleIcon size={19} className="text-primary" /><span className="flex-1">Call Mom</span><BellIcon className="text-primary" /><span>6:00 pm</span></div>
        <p className="mt-2 text-[11px] text-muted-foreground">Type “call Mom at 6pm”, check the time, then save.</p>
      </div>}
      {step === "voice" && <div className="rounded-xl border bg-card p-3 text-xs">
        <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">“Remind me to water the plants…”</span><span className="rounded-full bg-primary/10 p-2 text-primary"><MicrophoneIcon size={19} /></span></div>
        <p className="mt-2 text-[11px] text-muted-foreground">Check the words and time before saving. Voice stays on your Mac.</p>
      </div>}
      {step === "breathe" && <div className="rounded-xl border bg-card p-3 text-center text-xs">
        <WindIcon size={28} className="mx-auto mb-1.5 text-primary" />
        <p>Choose your time, pace and music.</p>
        <p className="mt-1 text-[11px] text-muted-foreground">You press Start. I'll breathe with you.</p>
      </div>}
      {step === "jokes" && <div className="rounded-xl border bg-card p-3 text-xs">
        <span className="text-[10px] text-muted-foreground">A little example</span>
        <p className="mt-1.5" role="status">{revealed ? "They wanted to grow a power plant!" : "Why did the gardener plant a light bulb?"}</p>
        <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => setRevealed(p => !p)}>{revealed ? "Again?" : "What?"}</Button>
      </div>}
      {step === "settings" && <div className="rounded-xl border bg-card p-3 text-xs space-y-2">
        <p className="flex items-start gap-2"><GearSixIcon className="shrink-0 text-primary" size={17} />Change reminders and jokes, or replay this tour.</p>
        <p className="flex items-start gap-2"><MoonStarsIcon className="shrink-0 text-primary" size={17} />Nap tucks me away. The menu-bar plant brings me back.</p>
      </div>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
    <div className="shrink-0 px-5 pb-3 pt-1">
      <div className="flex gap-2">
        {index > 0 && <Button variant="secondary" size="icon" className="rounded-xl" aria-label="Previous tour step" disabled={busy} onClick={() => onStep(TOUR_STEPS[index-1])}><ArrowLeftIcon /></Button>}
        <Button className="flex-1 rounded-xl" disabled={busy} onClick={() => index === TOUR_STEPS.length-1 ? onFinish("tasks") : onStep(TOUR_STEPS[index+1])}>{busy ? "Saving…" : index === TOUR_STEPS.length-1 ? "Make a reminder" : "Next"}<ArrowRightIcon /></Button>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground"><span>Tap an icon to jump in.</span><button className="min-h-7 hover:text-foreground" disabled={busy} onClick={() => onFinish("none")}>{index === TOUR_STEPS.length-1 ? "Done" : "Skip tour"}</button></div>
    </div>
  </Panel>;
}
