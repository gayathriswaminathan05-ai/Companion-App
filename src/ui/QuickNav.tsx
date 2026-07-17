// Horizontal quick-switch bar above an open panel — compact Figma-style pill.
import { useState } from "react";
import { MenuIcon, type MenuIconId } from "./MenuIcons";

export interface QuickNavItem {
  icon: MenuIconId;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const ACCENT = "#6A53E7";
const BTN = 26;
const ICON = 15;
const BTN_SHADOW = "0px -1px 3px rgba(0,0,0,0.08), 0px 2px 3px rgba(0,0,0,0.08)";

export default function QuickNav({ items }: { items: QuickNavItem[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div
      onMouseEnter={() => window.companion?.setClickThrough(false)}
      onMouseLeave={() => {
        window.companion?.setClickThrough(true);
        setHovered(null);
      }}
      style={{
        display: "flex",
        gap: 7,
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "auto",
        padding: "5px 7px",
        borderRadius: 22,
        background: "rgba(243, 243, 243, 0.94)",
        border: "1px solid #ffffff",
        boxShadow: "0 4px 14px rgba(32, 29, 47, 0.12)",
        backdropFilter: "blur(40px) saturate(1.4)",
        WebkitBackdropFilter: "blur(40px) saturate(1.4)",
        isolation: "isolate",
        width: "fit-content",
        flexShrink: 0,
      }}
    >
      {items.map((it) => {
        const hot = it.active || hovered === it.label;
        return (
          <button
            key={it.label}
            onClick={it.onClick}
            title={it.label}
            onMouseEnter={() => setHovered(it.label)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: BTN,
              height: BTN,
              borderRadius: 14,
              border: "none",
              background: hot ? ACCENT : "#ffffff",
              color: hot ? "#ffffff" : ACCENT,
              boxShadow: BTN_SHADOW,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              transform: hot ? "scale(1.06)" : "scale(1)",
              transition: "background 0.18s ease, color 0.18s ease, transform 0.15s ease",
            }}
          >
            <MenuIcon id={it.icon} size={ICON} />
          </button>
        );
      })}
    </div>
  );
}
