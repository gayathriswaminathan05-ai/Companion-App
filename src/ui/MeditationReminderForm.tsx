import { useState } from "react";
import { Panel, PanelHeader } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function localMinute(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function MeditationReminderForm({ onBack, onSchedule }: {
  onBack: () => void;
  onSchedule: (due: Date, recurring?: "daily") => void;
}) {
  const [when, setWhen] = useState(() => localMinute(new Date(Date.now() + 3600_000)));
  const [daily, setDaily] = useState(false);
  const [error, setError] = useState("");
  return <Panel>
    <PanelHeader title="Meditation reminder" onClose={onBack} />
    <form className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 pb-3" onSubmit={event => {
      event.preventDefault();
      const due = new Date(when);
      if (!Number.isFinite(due.getTime()) || due.getTime() <= Date.now()) {
        setError("Choose a time in the future.");
        return;
      }
      onSchedule(due, daily ? "daily" : undefined);
    }}>
      <p className="text-xs text-muted-foreground">I'll ring my bell when it's time for a quiet minute. You decide when to start.</p>
      <label className="flex flex-col gap-1.5 text-xs">When
        <Input type="datetime-local" aria-label="Meditation reminder time" required value={when} onChange={event => { setWhen(event.target.value); setError(""); }} />
      </label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={daily} onChange={event => setDaily(event.target.checked)} />Repeat every day</label>
      <p className="text-[11px] text-muted-foreground">Saved in Tasks as “Meditation break”. You can change or remove it there. Your Mac needs to be awake with the app running to ring on time.</p>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="mt-auto flex gap-2"><Button size="sm" type="submit">Set reminder</Button><Button size="sm" type="button" variant="ghost" onClick={onBack}>Back</Button></div>
    </form>
  </Panel>;
}
