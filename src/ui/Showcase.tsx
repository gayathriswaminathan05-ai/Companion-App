// Hidden animation showcase: opened via the secret dot at the left end of
// the menu bar. Lets Gayathri (or a curious user) play any animation on
// demand — also handy for recording marketing clips.
import type { CharacterState } from "../character/types";

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
  { state: "juggling", icon: "🤹", label: "juggle" },
  { state: "celebrating", icon: "🎉", label: "party" },
  { state: "sleeping", icon: "😴", label: "sleep" },
  { state: "waving", icon: "👋", label: "wave" },
  { state: "thinking", icon: "💭", label: "think" },
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
      onMouseEnter={() => window.companion?.setClickThrough(false)}
      onMouseLeave={() => window.companion?.setClickThrough(true)}
      style={{
        position: "absolute",
        top: 8,
        left: 10,
        right: 10,
        zIndex: 30,
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "auto",
        padding: "9px 10px",
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(255,253,248,0.68), rgba(255,248,236,0.56))",
        backdropFilter: "blur(16px) saturate(1.35)",
        WebkitBackdropFilter: "blur(16px) saturate(1.35)",
        border: "1px solid rgba(255,255,255,0.72)",
        boxShadow:
          "0 8px 22px rgba(90,74,58,0.2), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      {SHOW.map((s) => (
        <button
          key={s.state}
          title={s.label}
          onClick={() => onPlay(s.state)}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "1.5px solid #e0cfa8",
            background: "rgba(255,252,246,0.9)",
            fontSize: 14,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          {s.icon}
        </button>
      ))}
      <button
        onClick={onClose}
        title="close"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "1.5px solid #d8c9ac",
          background: "rgba(255,252,246,0.85)",
          color: "#a08e70",
          fontSize: 10,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
