import { ALL_STATES, SPROUT_STAGES } from "./character/types";
import type { CharacterState, SproutStage } from "./character/types";

// Temporary Day 2 panel for previewing every animation state.
// Replaced by the real character menu on Day 3.
export default function DebugMenu({
  onState,
  onTestNudge,
  onTestJoke,
  onSprout,
  onClose,
  current,
  sprout,
}: {
  onState: (s: CharacterState) => void;
  onTestNudge: (k: "stretch" | "water" | "bedtime") => void;
  onTestJoke: () => void;
  onSprout: (s: SproutStage) => void;
  onClose: () => void;
  current: CharacterState;
  sprout: SproutStage;
}) {
  const btn: React.CSSProperties = {
    fontSize: 11,
    padding: "3px 6px",
    borderRadius: 6,
    border: "1px solid #d8c9ac",
    background: "#fffdf7",
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
  };
  return (
    <div
      onMouseEnter={() => window.companion?.setClickThrough(false)}
      style={{
        position: "absolute",
        inset: 4,
        borderRadius: 12,
        background: "rgba(255, 250, 240, 0.96)",
        border: "1px solid #e5d7ba",
        padding: 8,
        overflowY: "auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: "#8a7a5e", marginBottom: 6 }}>
        moods (debug)
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {ALL_STATES.map((s) => (
          <button
            key={s}
            style={{ ...btn, background: s === current ? "#ffe9c2" : btn.background as string }}
            onClick={() => onState(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#8a7a5e", margin: "8px 0 6px" }}>
        sprout
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {SPROUT_STAGES.map((s) => (
          <button
            key={s}
            style={{ ...btn, background: s === sprout ? "#dff0cf" : btn.background as string }}
            onClick={() => onSprout(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#8a7a5e", margin: "8px 0 6px" }}>nudges (test)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {(["stretch", "water", "bedtime"] as const).map((k) => (
          <button key={k} style={btn} onClick={() => { onTestNudge(k); onClose(); }}>{k}</button>
        ))}
        <button style={btn} onClick={() => { onTestJoke(); onClose(); }}>joke</button>
      </div>
      <button style={{ ...btn, marginTop: 10, width: "100%" }} onClick={onClose}>
        close
      </button>
    </div>
  );
}
