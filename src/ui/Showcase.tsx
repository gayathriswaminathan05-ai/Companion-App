// Hidden animation showcase: opened via the secret dot at the left end of
// the menu bar. Lets Gayathri (or a curious user) play any animation on
// demand — also handy for recording marketing clips.
import type { CharacterState } from "../character/types";
import { XIcon } from "@phosphor-icons/react";
import { barButtonClass, barClass } from "./RadialMenu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHOW: { state: CharacterState; icon: string; label: string }[] = [
  { state: "idle", icon: "🧍", label: "calm" },
  { state: "idlehop", icon: "🦘", label: "hop" },
  { state: "lying", icon: "🛋️", label: "lounge" },
  { state: "hammock", icon: "🕶️", label: "hammock" },
  { state: "meditate", icon: "🧘", label: "meditate" },
  { state: "picnic", icon: "🧺", label: "picnic" },
  { state: "groove", icon: "🎧", label: "groove" },
  { state: "hula", icon: "🌀", label: "hula" },
  { state: "stretching", icon: "🤸", label: "stretch" },
  { state: "watering", icon: "💧", label: "water" },
  { state: "dragged", icon: "✋", label: "dangle" },
  { state: "celebrating", icon: "🎉", label: "party" },
  { state: "noting", icon: "📝", label: "notes" },
  { state: "sleeping", icon: "😴", label: "sleep" },
  { state: "waving", icon: "👋", label: "wave" },
  { state: "meeting", icon: "🔔", label: "bell" },
  { state: "thinking", icon: "💭", label: "think" },
  { state: "coffee", icon: "☕", label: "coffee" },
  { state: "grow1to2", icon: "🌱", label: "grow 1→2" },
];

export default function Showcase({
  onPlay,
  onClose,
}: {
  onPlay: (s: CharacterState) => void;
  onClose: () => void;
}) {
  return (
    <div
      data-hit="1"
      className={cn(barClass, "pointer-events-auto relative z-30 w-full flex-wrap justify-center gap-1.5 rounded-2xl p-2.5")}
    >
      {SHOW.map((s) => (
        <button
          key={s.state}
          title={s.label}
          aria-label={s.label}
          onClick={() => onPlay(s.state)}
          className={cn(barButtonClass, "size-8 border bg-card text-[15px]")}
        >
          {s.icon}
        </button>
      ))}
      <Button variant="ghost" size="icon-sm" className="rounded-full text-muted-foreground" onClick={onClose} aria-label="close showcase">
        <XIcon />
      </Button>
    </div>
  );
}
