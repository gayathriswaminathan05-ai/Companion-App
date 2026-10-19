import { BellRingingIcon, CheckIcon, ClockIcon } from "@phosphor-icons/react";
import { SpeechBubble } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FiredReminder {
  id: string;
  text: string;
  timeLabel: string;
  missed: boolean;
  recurring?: "daily";
}

// A task's time has come: small "when" line, the task as the headline, then
// done / snooze. Missed-while-away gets a softer amber line.
export default function ReminderBubble({
  fired,
  onDone,
  onSnooze,
  preview = false,
}: {
  fired: FiredReminder;
  onDone: () => void;
  onSnooze: () => void;
  preview?: boolean;
}) {
  return (
    <SpeechBubble role="alert">
      {preview && <p className="mb-2 text-xs font-medium text-muted-foreground">Test preview · nothing is saved</p>}
      <div className={cn("mb-1 flex items-center gap-1.5 text-xs font-medium", fired.missed ? "text-warning" : "text-primary")}>
        {fired.missed ? <ClockIcon className="size-3.5" /> : <BellRingingIcon className="size-3.5" weight="fill" />}
        {fired.missed ? `While you were away, ${fired.timeLabel}` : `It's time, ${fired.timeLabel}`}
      </div>
      <p className="text-[15px] leading-snug font-semibold tracking-tight break-words">{fired.text}</p>
      <div className="mt-3 flex gap-1.5">
        <Button className="flex-1" onClick={onDone}>
          <CheckIcon weight="bold" />
          Done
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onSnooze}>
          Snooze 10 min
        </Button>
      </div>
    </SpeechBubble>
  );
}
