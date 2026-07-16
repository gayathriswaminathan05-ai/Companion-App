// Horizontal quick-switch bar shown above an open panel: jump between
// features without closing and re-juggling the menu.

export interface QuickNavItem {
  icon: string;
  label: string;
  color: string;
  active?: boolean;
  onClick: () => void;
}

export default function QuickNav({ items }: { items: QuickNavItem[] }) {
  return (
    <div
      onMouseEnter={() => window.companion?.setClickThrough(false)}
      onMouseLeave={() => window.companion?.setClickThrough(true)}
      style={{
        display: "flex",
        gap: 8,
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "auto",
        // Frosted-glass pill, matching the juggle menu bar.
        padding: "7px 12px",
        borderRadius: 22,
        background: "linear-gradient(180deg, rgba(255,253,248,0.62), rgba(255,248,236,0.5))",
        backdropFilter: "blur(16px) saturate(1.35)",
        WebkitBackdropFilter: "blur(16px) saturate(1.35)",
        border: "1px solid rgba(255,255,255,0.72)",
        boxShadow:
          "0 8px 22px rgba(90,74,58,0.2), 0 2px 6px rgba(90,74,58,0.09), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(90,74,58,0.05)",
        width: "fit-content",
        margin: "0 auto",
      }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          onClick={it.onClick}
          title={it.label}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: `2px solid ${it.color}`,
            background: it.active ? it.color : "rgba(255, 250, 240, 0.97)",
            boxShadow: "0 2px 6px rgba(90, 70, 40, 0.2)",
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            transform: it.active ? "scale(1.12)" : "scale(1)",
            transition: "transform 0.15s, background 0.15s",
          }}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}
