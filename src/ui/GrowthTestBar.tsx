// Growth test strip — sits beside the plant so Gayathri can jump idle stages
// and replay level-up transitions. Can be hidden; a tiny chip brings it back.
import { SPRITES } from "../generated/sprites";
import {
  GROWTH_EMOJI,
  GROWTH_LABEL,
  type GrowthStage,
} from "../growth";

const STAGES: GrowthStage[] = [1, 2, 3, 4, 5, 6];

const TRANSITIONS: { from: GrowthStage; to: GrowthStage }[] = [
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
  { from: 5, to: 6 },
];

function hasClip(from: GrowthStage, to: GrowthStage): boolean {
  const key = `grow${from}to${to}`;
  const spr = (SPRITES as Record<string, { frames?: string[] }>)[key];
  return Boolean(spr?.frames?.length);
}

const shell: React.CSSProperties = {
  position: "absolute",
  right: 6,
  bottom: 16,
  zIndex: 40,
  pointerEvents: "auto",
  fontFamily: "system-ui, sans-serif",
};

export default function GrowthTestBar({
  growthStage,
  visible,
  onVisibleChange,
  onIdleStage,
  onPlayTransition,
  onPlayWatering,
}: {
  growthStage: GrowthStage;
  visible: boolean;
  onVisibleChange: (v: boolean) => void;
  onIdleStage: (s: GrowthStage) => void;
  onPlayTransition: (from: GrowthStage, to: GrowthStage) => void;
  onPlayWatering?: () => void;
}) {
  const chip: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1.5px solid #e0cfa8",
    background: "rgba(255,252,246,0.95)",
    fontSize: 12,
    fontWeight: 700,
    color: "#5a4a3a",
    cursor: "pointer",
    fontFamily: "system-ui, sans-serif",
    padding: 0,
    lineHeight: 1,
  };
  const playBtn: React.CSSProperties = {
    ...chip,
    width: "100%",
    height: 26,
    fontSize: 11,
    fontWeight: 600,
  };

  if (!visible) {
    return (
      <button
        type="button"
        title="Show growth test"
        onClick={() => onVisibleChange(true)}
        data-hit="1"
        style={{
          ...shell,
          width: 34,
          height: 34,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.75)",
          background: "linear-gradient(180deg, rgba(255,253,248,0.82), rgba(255,248,236,0.72))",
          backdropFilter: "blur(14px) saturate(1.3)",
          WebkitBackdropFilter: "blur(14px) saturate(1.3)",
          boxShadow: "0 4px 12px rgba(90,74,58,0.16)",
          color: "#9a8568",
          fontSize: 14,
          cursor: "pointer",
          padding: 0,
        }}
      >
        🌱
      </button>
    );
  }

  return (
    <div
      data-hit="1"
      style={{
        ...shell,
        width: 78,
        display: "flex",
        flexDirection: "column",
        gap: 5,
        padding: "8px 7px",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(255,253,248,0.82), rgba(255,248,236,0.72))",
        backdropFilter: "blur(14px) saturate(1.3)",
        WebkitBackdropFilter: "blur(14px) saturate(1.3)",
        border: "1px solid rgba(255,255,255,0.75)",
        boxShadow: "0 6px 18px rgba(90,74,58,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: "#9a8568",
            flex: 1,
            textAlign: "center",
          }}
        >
          growth test
        </div>
        <button
          type="button"
          title="Hide growth test"
          onClick={() => onVisibleChange(false)}
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: "#b09a7a",
            fontSize: 12,
            lineHeight: 1,
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 9, color: "#b09a7a", textAlign: "center", marginTop: -2 }}>
        idle
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 4,
        }}
      >
        {STAGES.map((s) => (
          <button
            key={s}
            type="button"
            title={`${GROWTH_EMOJI[s]} ${GROWTH_LABEL[s]}`}
            onClick={() => onIdleStage(s)}
            style={{
              ...chip,
              background: s === growthStage ? "#dff0cf" : (chip.background as string),
              borderColor: s === growthStage ? "#a8c98a" : "#e0cfa8",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {onPlayWatering && (
        <button
          type="button"
          title={`Play stage ${growthStage} self-water`}
          onClick={onPlayWatering}
          style={{ ...playBtn, marginTop: 2 }}
        >
          💧 water
        </button>
      )}

      <div style={{ fontSize: 9, color: "#b09a7a", textAlign: "center", marginTop: 2 }}>
        grow ▶
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {TRANSITIONS.map(({ from, to }) => {
          const ready = hasClip(from, to);
          return (
            <button
              key={`${from}-${to}`}
              type="button"
              disabled={!ready}
              title={
                ready
                  ? `Play ${from}→${to} celebration + leaf grow`
                  : `${from}→${to} clip not ready yet`
              }
              onClick={() => onPlayTransition(from, to)}
              style={{
                ...playBtn,
                opacity: ready ? 1 : 0.38,
                cursor: ready ? "pointer" : "not-allowed",
                background:
                  ready && growthStage === to
                    ? "#ffe9c2"
                    : (playBtn.background as string),
              }}
            >
              {from}→{to}
            </button>
          );
        })}
      </div>
    </div>
  );
}
