import { SpeechBubble } from "@/components/panel";
import { Button } from "@/components/ui/button";

// Gentle care / joke / meeting bubble: one line, one-click dismiss, never modal.
export default function NudgeBubble({
  text,
  actions,
}: {
  text: string;
  actions: { label: string; primary?: boolean; onClick: () => void }[];
}) {
  return (
    <SpeechBubble role="status">
      <p className="leading-relaxed">{text}</p>
      <div className="mt-3 flex gap-1.5">
        {actions.map((a) => (
          <Button key={a.label} variant={a.primary ? "default" : "secondary"} className="flex-1" onClick={a.onClick}>
            {a.label}
          </Button>
        ))}
      </div>
    </SpeechBubble>
  );
}
