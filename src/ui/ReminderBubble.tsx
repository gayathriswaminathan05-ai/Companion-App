import { COLORS, panel, smallBtn, primaryBtn } from "./theme";

export interface FiredReminder {
  id: string;
  text: string;
  timeLabel: string;
  missed: boolean;
  recurring?: "daily";
}

export default function ReminderBubble({
  fired,
  onDone,
  onSnooze,
}: {
  fired: FiredReminder;
  onDone: () => void;
  onSnooze: () => void;
}) {
  return (
    <div
      onMouseEnter={() => window.companion?.setClickThrough(false)}
      onMouseLeave={() => window.companion?.setClickThrough(true)}
      style={{
        ...panel,
        position: "absolute",
        bottom: 212,
        left: "50%",
        transform: "translateX(-50%)",
        width: 250,
        padding: "12px 14px",
        pointerEvents: "auto",
        zIndex: 20,
        animation: "bubblein 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)",
      }}
    >
      <div style={{ fontSize: 12.5, lineHeight: 1.45, color: COLORS.text }}>
        ⏰ {fired.missed ? "psst — while you were away: " : ""}
        <b style={{ color: COLORS.bubbleText }}>{fired.text}</b>
        {fired.missed && (
          <span style={{ color: COLORS.textSoft }}> (this was for {fired.timeLabel})</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button style={{ ...primaryBtn, flex: 1 }} onClick={onDone}>
          done ✓
        </button>
        <button style={{ ...smallBtn, flex: 1 }} onClick={onSnooze}>
          +10 min
        </button>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: -6,
          left: "50%",
          marginLeft: -6,
          width: 12,
          height: 12,
          background: COLORS.panelBg,
          borderRight: `1px solid ${COLORS.panelBorder}`,
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          transform: "rotate(45deg)",
          backdropFilter: "blur(56px)",
          WebkitBackdropFilter: "blur(56px)",
        }}
      />
      <style>{`
        @keyframes bubblein {
          from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.9); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
