import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, SpeakerHighIcon, SpeakerSlashIcon, PlantIcon } from "@phosphor-icons/react";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { SETUP_STEPS, type SetupProgress, type SetupStep, type ScheduledCare } from "../onboarding";

const COPY: Record<SetupStep, { title: string; description: string }> = {
  name: { title: "Hi! What will you call me?", description: "I'm your little desk plant. Let's make a little room for you in your day." },
  water: { title: "A little sip together?", description: "I can remind you to drink water while you're working." },
  movement: { title: "Let's move a little.", description: "A stretch, a short walk, or movement that feels good for you." },
  meditation: { title: "Make room for a quiet moment?", description: "I'll invite you to breathe with me. You choose when to start the voice and music." },
  meal: { title: "Lunch deserves a proper break.", description: "Pick a daily time to step away and enjoy a meal." },
  coffee: { title: "Fancy a little tea break?", description: "A daily pause for coffee, tea, or whatever's in your cup." },
  bedtime: { title: "When shall we say goodnight?", description: "A gentle evening nudge to wind down, whenever that suits you." },
  microphone: { title: "You can tell me, or type it.", description: "Dictate a task or answer a joke by holding the microphone button." },
  ready: { title: "Our little routine, your way.", description: "Everything can be changed later. There are no streaks to lose and no guilt." },
};
const TIMES = { meditation: "17:00", meal: "13:00", coffee: "15:00", bedtime: "23:00" };
function clockLabel(time: string | null) {
  if (!time) return "Off";
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

export default function OnboardingPanel({ progress, onChange, onFinish, onSkip, busy, error, onListen, onStop }: {
  progress: SetupProgress; onChange: (draft: SetupProgress) => void;
  onFinish: () => void; onSkip: () => void; busy: boolean; error: string;
  onListen: (text: string) => void; onStop: () => void;
}) {
  const step = progress.step;
  const index = SETUP_STEPS.indexOf(step);
  const { title, description } = COPY[step];
  const heading = useRef<HTMLHeadingElement>(null);
  const [mic, setMic] = useState<"idle" | "asking" | "allowed" | "denied">("idle");
  const [reading, setReading] = useState(false);
  useEffect(() => { heading.current?.focus(); setReading(false); onStop(); }, [step]);
  const patch = (values: Partial<SetupProgress>) => onChange({ ...progress, ...values });
  const next = () => { onStop(); patch({ step: SETUP_STEPS[index + 1] }); };
  const daily = ["meditation", "meal", "coffee", "bedtime"].includes(step);
  const time = step === "bedtime" ? progress.bedtime : daily ? progress.times[step as ScheduledCare] : null;
  const setTime = (value: string | null) => step === "bedtime" ? patch({ bedtime: value }) : patch({ times: { ...progress.times, [step]: value } });
  const valid = step === "name" ? !!progress.name.trim() : !daily || time === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const enableMic = async () => {
    setMic("asking"); onStop();
    try { setMic(await window.companion.ensureMic() === true ? "allowed" : "denied"); }
    catch { setMic("denied"); }
  };
  return <Panel role="dialog" aria-label="Welcome setup" data-onboarding-step={step}>
    <div className="flex shrink-0 items-center justify-between px-4 pt-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><PlantIcon className="size-4 text-primary" />A little hello</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={reading ? "Stop reading" : "Read this step aloud"} onClick={() => {
        if (reading) onStop(); else onListen(`${title} ${description}`);
        setReading(!reading);
      }}>{reading ? <SpeakerSlashIcon /> : <SpeakerHighIcon />}</Button>
    </div>
    <div className="mx-4 mt-2 h-1 shrink-0 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={SETUP_STEPS.length} aria-valuenow={index + 1}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${(index + 1) / SETUP_STEPS.length * 100}%` }} />
    </div>
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); if (!valid || busy) return; if (step === "ready") onFinish(); else next(); }}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-4 pb-2">
        <div><h2 ref={heading} tabIndex={-1} className="text-lg leading-snug font-semibold tracking-tight outline-none">{title}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p></div>
        {step === "name" && <label className="flex flex-col gap-1.5 text-xs font-medium">Your plant's name
          <Input aria-label="Plant name" value={progress.name} maxLength={30} onChange={e => patch({ name: e.target.value })} placeholder="A name that makes you smile" />
          <span className="font-normal text-muted-foreground">Just on this Mac. You can rename me later.</span>
        </label>}
        {(step === "water" || step === "movement") && <>
          <label className="flex flex-col gap-1.5 text-xs font-medium">How often?
            <NativeSelect className="w-full" aria-label={step === "water" ? "Water reminder frequency" : "Movement reminder frequency"} value={step === "water" ? progress.waterMins : progress.movementMins} onChange={e => patch(step === "water" ? { waterMins: Number(e.target.value) } : { movementMins: Number(e.target.value) })}>
              <NativeSelectOption value="0">No reminder for now</NativeSelectOption>
              {[30,45,60,90,120,180].map(min => <NativeSelectOption key={min} value={min}>{min === 60 ? "Every hour" : `Every ${min} minutes`}</NativeSelectOption>)}
            </NativeSelect>
          </label>
          {step === "movement" && progress.movementMins > 0 && <label className="flex flex-col gap-1.5 text-xs font-medium">What feels right?
            <NativeSelect className="w-full" aria-label="Movement style" value={progress.movementStyle} onChange={e => patch({ movementStyle: e.target.value as SetupProgress["movementStyle"] })}>
              <NativeSelectOption value="mixed">Stretch and walk</NativeSelectOption><NativeSelectOption value="stretch">Stretch</NativeSelectOption><NativeSelectOption value="walk">Walk or move</NativeSelectOption>
            </NativeSelect>
          </label>}
          <p className="text-xs leading-relaxed text-muted-foreground">These count time at your desk. I'll leave space between nudges and keep them gentle.</p>
        </>}
        {daily && <>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-[13px]">Remind me daily
            <Switch aria-label="Daily reminder" checked={time !== null} onCheckedChange={on => setTime(on ? TIMES[step as keyof typeof TIMES] : null)} />
          </label>
          {time !== null && <label className="flex items-center justify-between gap-3 text-xs font-medium">At this time
            <Input className="w-32" type="time" aria-label="Daily reminder time" value={time} onChange={e => setTime(e.target.value)} required />
          </label>}
          <p className="text-xs leading-relaxed text-muted-foreground">{step === "bedtime" ? "Change this any time in Settings." : "Saved in Tasks, where you can edit or remove it."} If today's time has passed, we'll start tomorrow.</p>
        </>}
        {step === "microphone" && <>
          <p className="text-xs leading-relaxed text-muted-foreground">I only listen while you hold the mic. Voice is turned into text on your Mac. You can always type instead.</p>
          {mic === "allowed" ? <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">Microphone ready. You're in control.</p> : mic === "denied" ? <p role="status" className="text-xs leading-relaxed">Microphone access is off. Typing still works. You can allow it later in Mac System Settings → Privacy & Security → Microphone.</p> : <Button type="button" variant="secondary" disabled={mic === "asking"} onClick={() => void enableMic()}>{mic === "asking" ? "Waiting for macOS…" : "Enable microphone"}</Button>}
        </>}
        {step === "ready" && <>
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1.5 text-xs">
            <dt>My name</dt><dd className="max-w-40 truncate font-medium">{progress.name}</dd>
            <dt>Water</dt><dd>{progress.waterMins ? `${progress.waterMins} min` : "Off"}</dd>
            <dt>Movement</dt><dd>{progress.movementMins ? `${progress.movementMins} min` : "Off"}</dd>
            {(["meditation", "meal", "coffee"] as const).map(k => <div key={k} className="contents"><dt>{ { meditation: "Meditation", meal: "Meal", coffee: "Coffee / tea" }[k]}</dt><dd>{clockLabel(progress.times[k])}</dd></div>)}
            <dt>Bedtime</dt><dd>{clockLabel(progress.bedtime)}</dd>
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">Click me for Tasks, Breathe and Settings. Drag me to a comfy spot. Your Mac needs to be awake and Companion running for reminders.</p>
          <p className="text-xs leading-relaxed text-muted-foreground">No account needed. Optional Google Calendar alerts are in Settings. During this beta, your Google account must be invited to connect.</p>
        </>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="shrink-0 border-t px-4 py-2.5">
        <div className="flex gap-2">
          {index > 0 && <Button type="button" variant="secondary" disabled={busy} aria-label="Previous setup step" onClick={() => { onStop(); patch({ step: SETUP_STEPS[index - 1] }); }}><ArrowLeftIcon />Back</Button>}
          <Button className="flex-1" type="submit" disabled={!valid || busy}>{busy ? "Saving…" : step === "ready" ? "Let's begin" : step === "microphone" && mic !== "allowed" ? "Continue with typing" : "Next"}</Button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground"><span>{index + 1} of {SETUP_STEPS.length}</span><button type="button" className="min-h-6 underline underline-offset-2 hover:text-foreground" disabled={busy} onClick={onSkip}>Skip setup</button></div>
      </div>
    </form>
  </Panel>;
}
