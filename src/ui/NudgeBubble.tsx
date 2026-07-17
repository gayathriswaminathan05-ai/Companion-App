import { COLORS, panel, smallBtn, primaryBtn } from "./theme";

// Gentle care / joke bubble: one line, one-click dismiss, never modal.
export default function NudgeBubble({
  text,
  actions,
}: {
  text: string;
  actions: { label: string; primary?: boolean; onClick: () => void }[];
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
        width: 240,
        padding: "12px 14px",
        pointerEvents: "auto",
        zIndex: 20,
        animation: "nudgein 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)",
      }}
    >
      <div style={{ fontSize: 12.5, lineHeight: 1.45, color: COLORS.text }}>{text}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {actions.map((a) => (
          <button
            key={a.label}
            style={{
              ...(a.primary ? primaryBtn : smallBtn),
              flex: 1,
            }}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
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
        @keyframes nudgein {
          from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.9); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
