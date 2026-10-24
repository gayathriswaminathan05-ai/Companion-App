import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, SpeakerHighIcon, SpeakerSlashIcon, PauseIcon, PlayIcon, CheckIcon, InfoIcon, MicrophoneIcon } from "@phosphor-icons/react";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SETUP_STEPS, type SetupProgress, type SetupStep, type ScheduledCare } from "../onboarding";
import type { CharacterState } from "../character/types";

export const SETUP_POSES: Record<SetupStep, CharacterState> = {
  name: "waving", water: "watering", movement: "stretching", meditation: "meditate",
  meal: "picnic", coffee: "coffee", bedtime: "sleeping", microphone: "waving", ready: "waving",
};
const COPY: Record<SetupStep, { title: string; description: string; detail: string }> = {
  name: { title: "What's my name?", description: "A little plant. Your new desk buddy.", detail: "This name stays on your Mac. You can change it in Settings any time." },
  water: { title: "Sip, sip. Hooray.", description: "A little water break, every…", detail: "These reminders count time at your desk. I'll leave space between nudges." },
  movement: { title: "Wiggle with me?", description: "A little movement break, every…", detail: "Choose stretching, walking, or a mix. Reminders count time at your desk, with space between nudges." },
  meditation: { title: "And… breathe.", description: "A little quiet, just for you.", detail: "I'll invite you to breathe. Voice and music only start when you choose. Your reminder lives in Tasks. If today's time has passed, we'll start tomorrow." },
  meal: { title: "Lunch is a date.", description: "You, me, and something yummy.", detail: "Your daily meal reminder lives in Tasks. If today's time has passed, we'll start tomorrow." },
  coffee: { title: "Meet me for a cuppa?", description: "Tea, coffee, or a lovely little pause.", detail: "Your daily tea or coffee reminder lives in Tasks. If today's time has passed, we'll start tomorrow." },
  bedtime: { title: "Even plants need rest.", description: "When shall we wind down?", detail: "Change bedtime in Settings. If today's time has passed, we'll start tomorrow." },
  microphone: { title: "All ears. Well, leaves.", description: "Hold the mic to talk. Or just type.", detail: "Microphone access is optional. Voice is turned into text on your Mac, not sent to a cloud service. You can change permission in Mac System Settings → Privacy & Security → Microphone." },
  ready: { title: "We're going to get along.", description: "Little breaks. A little company. No guilt.", detail: "Click me for Tasks, Breathe and Settings. Drag me anywhere. Reminders need your Mac awake and Companion running. No account needed. Optional Google Calendar is in Settings; during this beta, only invited Google accounts can connect." },
};
const TIMES = { meditation: "17:00", meal: "13:00", coffee: "15:00", bedtime: "23:00" };
function clockLabel(time: string | null) {
  if (!time) return "Off";
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}
const intervalLabel = (min: number) => min === 0 ? "Not now" : min < 60 ? `${min} min` : min === 90 ? "90 min" : `${min / 60} hr`;

export default function OnboardingPanel({ progress, onChange, onFinish, onSkip, busy, error, onListen, onStop, motionPaused = false, onToggleMotion }: {
  progress: SetupProgress; onChange: (draft: SetupProgress) => void;
  onFinish: () => void; onSkip: () => void; busy: boolean; error: string;
  onListen: (text: string) => void; onStop: () => void;
  motionPaused?: boolean; onToggleMotion?: () => void;
}) {
  const step = progress.step;
  const index = SETUP_STEPS.indexOf(step);
  const { title: baseTitle, description, detail } = COPY[step];
  const title = step === "ready" ? `You + ${progress.name.trim() || "me"}.` : baseTitle;
  const heading = useRef<HTMLHeadingElement>(null);
  const [mic, setMic] = useState<"idle" | "asking" | "allowed" | "denied">("idle");
  const [reading, setReading] = useState(false);
  const [info, setInfo] = useState(false);
  useEffect(() => { heading.current?.focus(); setReading(false); setInfo(false); onStop(); }, [step]);
  const patch = (values: Partial<SetupProgress>) => onChange({ ...progress, ...values });
  const daily = ["meditation", "meal", "coffee", "bedtime"].includes(step);
  const time = step === "bedtime" ? progress.bedtime : daily ? progress.times[step as ScheduledCare] : null;
  const setTime = (value: string | null) => step === "bedtime" ? patch({ bedtime: value }) : patch({ times: { ...progress.times, [step]: value } });
  const valid = step === "name" ? !!progress.name.trim() : !daily || time === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const enableMic = async () => {
    setMic("asking"); onStop();
    try { setMic(await window.companion.ensureMic() === true ? "allowed" : "denied"); }
    catch { setMic("denied"); }
  };
  const routine = [
    ["Water", progress.waterMins ? `Every ${intervalLabel(progress.waterMins)}` : "Off"],
    ["Move", progress.movementMins ? `Every ${intervalLabel(progress.movementMins)}` : "Off"],
    ["Breathe", clockLabel(progress.times.meditation)], ["Meal", clockLabel(progress.times.meal)],
    ["Cuppa", clockLabel(progress.times.coffee)], ["Bedtime", clockLabel(progress.bedtime)],
  ];
  const selected = routine.filter(([, value]) => value !== "Off");
  return <Panel role="dialog" aria-label="Welcome setup" data-onboarding-step={step} className="rounded-[24px]">
    <div className="flex shrink-0 items-center justify-between px-4 pt-2.5">
      <div className="flex items-center gap-1.5" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={SETUP_STEPS.length} aria-valuenow={index + 1}>
        {SETUP_STEPS.map((s, i) => <span key={s} className={`h-1.5 rounded-full ${i === index ? "w-5 bg-primary" : i < index ? "w-1.5 bg-primary/55" : "w-1.5 bg-foreground/15"}`} />)}
        <span className="sr-only">{index + 1} of {SETUP_STEPS.length}</span>
      </div>
      <div className="flex">
        {onToggleMotion && <Button type="button" variant="ghost" size="icon-sm" aria-label={motionPaused ? "Play plant animation" : "Pause plant animation"} onClick={onToggleMotion}>{motionPaused ? <PlayIcon /> : <PauseIcon />}</Button>}
        <Button type="button" variant="ghost" size="icon-sm" aria-label={reading ? "Stop reading" : "Read this step aloud"} onClick={() => {
          if (reading) onStop(); else onListen(`${title} ${description}${step === "microphone" ? " Voice stays on your Mac." : ""}`);
          setReading(!reading);
        }}>{reading ? <SpeakerSlashIcon /> : <SpeakerHighIcon />}</Button>
      </div>
    </div>
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); if (!valid || busy) return; onStop(); if (step === "ready") onFinish(); else patch({ step: SETUP_STEPS[index + 1] }); }}>
      <div key={step} className="setup-step flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-5 pt-3 pb-2">
        <div className="w-full text-center"><h2 ref={heading} tabIndex={-1} className="break-words text-[23px] leading-[1.15] font-semibold tracking-tight outline-none">{title}</h2>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">{description}</p></div>
        {!info && <>
          {step === "name" && <div className="w-full pt-1">
            <Input aria-label="Plant name" className="h-12 rounded-xl text-center text-lg! font-medium" value={progress.name} maxLength={30} onChange={e => patch({ name: e.target.value })} placeholder="Something that makes you smile" autoComplete="off" />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">We can change it later.</p>
          </div>}
          {(step === "water" || step === "movement") && <div className="w-full space-y-3">
            <div role="group" aria-label={step === "water" ? "Water reminder frequency" : "Movement reminder frequency"} className="grid grid-cols-4 gap-1.5">
              {[0,30,45,60,90,120,180].map(min => <button type="button" key={min} aria-pressed={(step === "water" ? progress.waterMins : progress.movementMins) === min} onClick={() => patch(step === "water" ? { waterMins: min } : { movementMins: min })} className={`setup-choice ${min === 0 ? "col-span-2" : ""}`}>{intervalLabel(min)}</button>)}
            </div>
            {step === "movement" && progress.movementMins > 0 && <div role="group" aria-label="Movement style" className="grid grid-cols-3 gap-1.5">
              {([['mixed','Both'],['stretch','Stretch'],['walk','Walk']] as const).map(([value,label]) => <button type="button" className="setup-choice" key={value} aria-pressed={progress.movementStyle === value} onClick={() => patch({ movementStyle: value })}>{label}</button>)}
            </div>}
            {step === "water" && <p className="text-center text-[11px] text-muted-foreground">Between sips, I'll mind my own leaves.</p>}
          </div>}
          {daily && <div className="w-full">
            <label className="flex items-center justify-between gap-3 text-[13px]">A daily nudge
              <Switch aria-label="Daily reminder" checked={time !== null} onCheckedChange={on => setTime(on ? TIMES[step as keyof typeof TIMES] : null)} />
            </label>
            {time !== null ? <Input className="mx-auto mt-3 block h-14 w-48 rounded-xl text-center text-[25px]! font-medium tabular-nums" type="time" aria-label="Daily reminder time" value={time} onChange={e => setTime(e.target.value)} required /> : <p className="mt-5 text-center text-sm text-muted-foreground">No nudge? No problem.</p>}
          </div>}
          {step === "microphone" && <div className="w-full text-center">
            <p className="mb-3 text-xs text-muted-foreground">Voice stays on your Mac.</p>
            {mic === "allowed" ? <p role="status" className="flex items-center justify-center gap-2 text-sm text-primary"><CheckIcon />Ready when you are.</p> : mic === "denied" ? <p role="status" className="text-xs leading-relaxed">Microphone access is off. Typing still works.<br />You can enable it later in Mac Settings.</p> : <Button type="button" variant="secondary" className="rounded-xl" disabled={mic === "asking"} onClick={() => void enableMic()}><MicrophoneIcon />{mic === "asking" ? "Waiting for macOS…" : "Enable microphone"}</Button>}
          </div>}
          {step === "ready" && <div className="w-full">
            {selected.length ? <div className="grid grid-cols-2 gap-1.5">{selected.map(([label,value]) => <div key={label} className="flex items-center justify-between gap-1 rounded-lg bg-primary/7 px-2.5 py-2 text-[11px]"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>)}</div> : <p className="py-3 text-center text-sm text-muted-foreground">No reminders yet. We'll take it slow.</p>}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Click me to begin. Drag me anywhere.</p>
          </div>}
        </>}
        {info && <div id="setup-details" className="w-full rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <p>{detail}</p>
          {step === "ready" && <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1">{routine.map(([label,value]) => <div className="contents" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
        </div>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="shrink-0 px-5 pb-3 pt-2">
        <div className="flex gap-2">
          {index > 0 && <Button type="button" variant="secondary" size="icon" className="rounded-xl" disabled={busy} aria-label="Previous setup step" onClick={() => { onStop(); patch({ step: SETUP_STEPS[index - 1] }); }}><ArrowLeftIcon /></Button>}
          <Button className="flex-1 rounded-xl" type="submit" disabled={!valid || busy}>{busy ? "Saving…" : step === "ready" ? "Let's begin" : step === "microphone" && mic !== "allowed" ? "Continue with typing" : "Next"}<ArrowRightIcon /></Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <button type="button" className="flex min-h-7 items-center gap-1 hover:text-foreground" aria-label="About this step" aria-expanded={info} aria-controls={info ? "setup-details" : undefined} onClick={() => setInfo(!info)}><InfoIcon size={14} />{info ? "Back to choices" : "Good to know"}</button>
          <button type="button" className="min-h-7 hover:text-foreground" disabled={busy} onClick={onSkip}>Skip setup</button>
        </div>
      </div>
    </form>
  </Panel>;
}
