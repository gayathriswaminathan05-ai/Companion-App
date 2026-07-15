import { panel, smallBtn } from "./theme";

// Gentle care bubble: one line, one-click dismiss, never modal.
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
        padding: "10px 12px",
        pointerEvents: "auto",
        zIndex: 20,
        animation: "nudgein 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)",
      }}
    >
      <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>{text}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {actions.map((a) => (
          <button
            key={a.label}
            style={{
              ...smallBtn,
              flex: 1,
              ...(a.primary ? { borderColor: "#c9dfb2", background: "#eaf3df" } : {}),
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
          bottom: -7,
          left: "50%",
          marginLeft: -7,
          width: 14,
          height: 14,
          background: "rgba(255, 250, 240, 0.97)",
          borderRight: "1px solid #e5d7ba",
          borderBottom: "1px solid #e5d7ba",
          transform: "rotate(45deg)",
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
