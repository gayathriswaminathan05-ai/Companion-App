import { PlayIcon } from "@phosphor-icons/react";
import { Panel, PanelHeader, SectionLabel } from "@/components/panel";
import { Button } from "@/components/ui/button";

export const REMINDER_TESTS = [
  { id: "stretch", label: "Stretch", group: "Care nudges" },
  { id: "walk", label: "Walk or move", group: "Care nudges" },
  { id: "water", label: "Drink water", group: "Care nudges" },
  { id: "bedtime", label: "Bedtime", group: "Care nudges" },
  { id: "task", label: "Timed task", group: "Reminders" },
  { id: "missed", label: "Missed reminder", group: "Reminders" },
  { id: "daily", label: "Daily reminder", group: "Reminders" },
  { id: "meditation", label: "Meditation break", group: "Reminders" },
  { id: "meal", label: "Meal break", group: "Reminders" },
  { id: "coffee", label: "Tea or coffee break", group: "Reminders" },
  { id: "calendar", label: "Meeting in 5 min", group: "Calendar samples" },
  { id: "calendar-now", label: "Meeting starting now", group: "Calendar samples" },
  { id: "joke", label: "Tell a joke", group: "A little fun" },
] as const;

export type ReminderTestKind = (typeof REMINDER_TESTS)[number]["id"];

export default function ReminderTestPanel({ onPlay, onClose, voiceOn, soundsOn }: {
  onPlay: (kind: ReminderTestKind) => void;
  onClose: () => void;
  voiceOn: boolean;
  soundsOn: boolean;
}) {
  return (
    <Panel>
      <PanelHeader title="Test reminders & jokes" onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <p className="mb-2 text-xs text-muted-foreground">Try one now. No tasks, schedules or growth points will change.</p>
        <p className="text-xs text-muted-foreground">Voice {voiceOn ? "on" : "off"} · Sounds {soundsOn ? "on" : "off"}. Change these in Settings.</p>
        {["Care nudges", "Reminders", "Calendar samples", "A little fun"].map(group => (
          <section key={group}>
            <SectionLabel>{group}</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {REMINDER_TESTS.filter(test => test.group === group).map(test => (
                <Button key={test.id} variant="secondary" size="sm" className="h-auto min-h-9 justify-start whitespace-normal text-left" onClick={() => onPlay(test.id)}>
                  <PlayIcon className="size-3.5 shrink-0" />{test.label}
                </Button>
              ))}
            </div>
          </section>
        ))}
        <p className="mt-3 text-xs text-muted-foreground">Meal, tea/coffee and meditation use timed task reminders. Calendar previews use a sample meeting; no Google connection is needed.</p>
      </div>
    </Panel>
  );
}
