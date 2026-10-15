import { ALL_STATES } from "./character/types";
import type { CharacterState } from "./character/types";
import { GROWTH_EMOJI, GROWTH_LABEL, type GrowthStage } from "./growth";

const GROWTH_STAGES: GrowthStage[] = [1, 2, 3, 4, 5, 6, 7];

// Temporary panel for previewing every animation state + growth stages.
export default function DebugMenu({
  onState,
  onTestNudge,
  onTestJoke,
  soundsOn,
  onToggleSounds,
  onGrowthStage,
  onClose,
  current,
  growthStage,
}: {
  onState: (s: CharacterState) => void;
  onTestNudge: (k: "stretch" | "water" | "bedtime") => void;
  onTestJoke: () => void;
  soundsOn: boolean;
  onToggleSounds: () => void;
  onGrowthStage: (s: GrowthStage) => void;
  onClose: () => void;
  current: CharacterState;
  growthStage: GrowthStage;
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
      data-hit="1"
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
            style={{ ...btn, background: s === current ? "#ffe9c2" : (btn.background as string) }}
            onClick={() => onState(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#8a7a5e", margin: "8px 0 6px" }}>
        growth (idle)
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {GROWTH_STAGES.map((s) => (
          <button
            key={s}
            style={{ ...btn, background: s === growthStage ? "#dff0cf" : (btn.background as string) }}
            onClick={() => onGrowthStage(s)}
            title={GROWTH_LABEL[s]}
          >
            {GROWTH_EMOJI[s]} {s}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#8a7a5e", margin: "8px 0 6px" }}>nudges (test)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {(["stretch", "water", "bedtime"] as const).map((k) => (
          <button
            key={k}
            style={btn}
            onClick={() => {
              onTestNudge(k);
              onClose();
            }}
          >
            {k}
          </button>
        ))}
        <button
          style={btn}
          onClick={() => {
            onTestJoke();
            onClose();
          }}
        >
          joke
        </button>
        <button
          style={{ ...btn, background: soundsOn ? "#dff0cf" : (btn.background as string) }}
          onClick={onToggleSounds}
        >
          {soundsOn ? "sounds: on" : "sounds: off"}
        </button>
      </div>
      <button style={{ ...btn, marginTop: 10, width: "100%" }} onClick={onClose}>
        close
      </button>
    </div>
  );
}
