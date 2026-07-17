// Menu v5: Figma pill bar — frosted capsule with white circular buttons;
// default = purple outline icons, hover = solid #6A53E7 with white icons.
import { useState } from "react";
import { MenuIcon, type MenuIconId } from "./MenuIcons";

export interface RadialItem {
  icon: MenuIconId;
  label: string;
  onClick: () => void;
}

const WIN_W = 384;
const WIN_H = 600;
const CHAR_H = 240;
const PLANT_X = 192;
const MENU_GAP = 55;
const BTN = 36;
const ICON = 20;
const GAP = 10;
const PILL_PAD = 8;
const CLOSE = 18;
const ACCENT = "#6A53E7";
const BTN_SHADOW = "0px -2px 4px rgba(0,0,0,0.08), 0px 3px 4px rgba(0,0,0,0.08)";

export default function RadialMenu({
  items,
  clipLeft,
  clipRight,
  clipTop = 0,
  clipBottom = 0,
  plantScale = 1,
  onDismiss,
  onSecret,
}: {
  items: RadialItem[];
  clipLeft: number;
  clipRight: number;
  clipTop?: number;
  clipBottom?: number;
  plantScale?: number;
  onDismiss?: () => void;
  onSecret?: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const scale = Math.min(1.2, Math.max(0.6, plantScale || 1));
  const pillH = PILL_PAD * 2 + BTN;
  let barY = WIN_H - CHAR_H * scale - MENU_GAP;
  barY = Math.max(clipTop + pillH / 2 + 8, Math.min(barY, WIN_H - clipBottom - pillH / 2 - 8));

  const n = items.length;
  const pillW = PILL_PAD * 2 + n * BTN + (n - 1) * GAP;

  const visL = clipLeft + 5;
  const visR = WIN_W - clipRight - 5;
  // Leave a little room on the right for the floating ✕ above the bar edge.
  const closePad = onDismiss ? CLOSE + 4 : 0;
  let barX = Math.min(Math.max(PLANT_X, visL + pillW / 2), visR - pillW / 2 - closePad);
  if (visR - visL < pillW + closePad) barX = (visL + visR - closePad) / 2;

  const pillLeft = barX - pillW / 2;
  const pillTop = barY - pillH / 2;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 9 }}>
      <div
        className="menu-rise"
        style={{
          position: "absolute",
          left: pillLeft,
          top: pillTop,
          width: pillW,
          height: pillH,
          display: "flex",
          alignItems: "center",
          gap: GAP,
          padding: PILL_PAD,
          boxSizing: "border-box",
          borderRadius: 28,
          background: "rgba(243, 243, 243, 0.94)",
          border: "1px solid #ffffff",
          boxShadow: "0 6px 18px rgba(32, 29, 47, 0.12)",
          backdropFilter: "blur(40px) saturate(1.4)",
          WebkitBackdropFilter: "blur(40px) saturate(1.4)",
          isolation: "isolate",
          pointerEvents: "auto",
        }}
        onMouseEnter={() => window.companion?.setClickThrough(false)}
        onMouseLeave={() => window.companion?.setClickThrough(true)}
      >
        {onSecret && (
          <button
            onClick={onSecret}
            aria-label="showcase"
            title="showcase"
            style={{
              position: "absolute",
              left: 2,
              top: "50%",
              transform: "translateY(-50%)",
              width: 12,
              height: 12,
              border: "none",
              background: "transparent",
              color: ACCENT,
              fontSize: 7,
              opacity: 0.15,
              cursor: "pointer",
              padding: 0,
              zIndex: 2,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.7";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = "0.15";
            }}
          >
            ✦
          </button>
        )}

        {items.map((item, i) => {
          const hot = hovered === item.label;
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              title={item.label}
              className="menu-item"
              style={{
                animationDelay: `${90 + i * 40}ms`,
                width: BTN,
                height: BTN,
                minWidth: BTN,
                borderRadius: 20,
                border: "none",
                background: hot ? ACCENT : "#ffffff",
                color: hot ? "#ffffff" : ACCENT,
                boxShadow: BTN_SHADOW,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                transition: "background 0.18s ease, color 0.18s ease, transform 0.15s ease",
                transform: hot ? "scale(1.04)" : "scale(1)",
                position: "relative",
                flexShrink: 0,
              }}
              onMouseEnter={() => setHovered(item.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <MenuIcon id={item.icon} size={ICON} />
              <span
                style={{
                  position: "absolute",
                  top: BTN + 6,
                  left: "50%",
                  transform: `translate(-50%, ${hot ? 0 : -3}px)`,
                  opacity: hot ? 1 : 0,
                  transition: "opacity 0.15s, transform 0.15s",
                  fontSize: 9,
                  fontFamily: "system-ui, sans-serif",
                  color: "#201d2f",
                  background: "rgba(255,255,255,0.92)",
                  borderRadius: 5,
                  padding: "1px 6px",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  boxShadow: "0 2px 8px rgba(32,29,47,0.12)",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          title="close"
          className="menu-item"
          onMouseEnter={() => {
            window.companion?.setClickThrough(false);
            setHovered("__close");
          }}
          onMouseLeave={() => {
            window.companion?.setClickThrough(true);
            setHovered(null);
          }}
          style={{
            position: "absolute",
            left: pillLeft + pillW - CLOSE / 2,
            top: pillTop - CLOSE - 2,
            zIndex: 11,
            width: CLOSE,
            height: CLOSE,
            borderRadius: "50%",
            border: "1px solid #ffffff",
            background: hovered === "__close" ? ACCENT : "rgba(255,255,255,0.92)",
            color: hovered === "__close" ? "#ffffff" : "#9e9e9e",
            boxShadow: "0 2px 6px rgba(32,29,47,0.14)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1,
            pointerEvents: "auto",
            transition: "background 0.15s ease, color 0.15s ease",
            animationDelay: `${90 + n * 40}ms`,
          }}
        >
          ✕
        </button>
      )}

      <style>{`
        .menu-rise {
          /* Opacity-only entrance — transform on this node kills backdrop-filter. */
          animation: menurise 0.28s ease-out backwards;
        }
        @keyframes menurise {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .menu-item {
          animation: itempop 0.24s cubic-bezier(0.3, 1.35, 0.5, 1) backwards;
        }
        @keyframes itempop {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
