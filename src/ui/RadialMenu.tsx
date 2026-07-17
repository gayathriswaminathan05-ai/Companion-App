// Menu v4: click the plant → it does its little jump (idlehop sprite, played
// by App) → this frosted-glass bar RISES UP above it, with a caret pointing
// down at the plant like a speech-bubble tooltip. (The juggling-balls
// choreography of v1-v3 is retired.)
import { useState } from "react";

export interface RadialItem {
  icon: string;
  label: string;
  onClick: () => void;
}

const WIN_W = 320;
const BALL_COLORS = ["#FF8A7A", "#FFD75E", "#93C46F", "#7FB8E8", "#F9A8C4"];

const PLANT_X = 160; // the succulent stands centered in the window
const BAR_Y = 254; // bar center: caret tip lands just above the leaf tips (~y304), no overlap
const SLOT = 52; // horizontal distance between item centers
const BALL = 38; // item button size
const PILL_PAD = 12;

export default function RadialMenu({
  items,
  clipLeft,
  clipRight,
  onDismiss,
  onSecret,
}: {
  items: RadialItem[];
  clipLeft: number;
  clipRight: number;
  onDismiss?: () => void;
  onSecret?: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const n = items.length;
  // The ✕ lives inside the pill, after the last item (slightly tighter slot).
  const dismissGap = onDismiss ? 44 : 0;
  const pillW =
    PILL_PAD + BALL / 2 + (n - 1) * SLOT + dismissGap + (onDismiss ? 11 : BALL / 2) + PILL_PAD;

  // Keep the whole bar inside the visible part of the window, wherever the
  // plant has been parked on screen.
  const visL = clipLeft + 5;
  const visR = WIN_W - clipRight - 5;
  let barX = Math.min(Math.max(PLANT_X, visL + pillW / 2), visR - pillW / 2);
  if (visR - visL < pillW) barX = (visL + visR) / 2;

  const firstBall = -pillW / 2 + PILL_PAD + BALL / 2;
  const offsets = items.map((_, i) => firstBall + i * SLOT);
  const dismissOffset = firstBall + (n - 1) * SLOT + dismissGap;

  // The caret points at the plant even when the bar slid sideways at an edge.
  const caretX = Math.min(Math.max(PLANT_X, barX - pillW / 2 + 26), barX + pillW / 2 - 26);

  return (
    <div className="menu-rise" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 9 }}>
      {/* Tooltip tail first (painted under the pill), then the glass pill. */}
      <div
        className="menu-caret"
        style={{
          position: "absolute",
          left: caretX - 9,
          top: BAR_Y + 27 - 9,
          width: 18,
          height: 18,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: barX - pillW / 2,
          top: BAR_Y - 27,
          width: pillW,
          height: 54,
        }}
      >
        <div className="menu-pill" />
      </div>

      {items.map((item, i) => {
        const color = BALL_COLORS[i % BALL_COLORS.length];
        const isHover = hovered === item.label;
        return (
          <div
            key={item.label}
            style={{
              position: "absolute",
              zIndex: 10,
              left: barX + offsets[i] - BALL / 2,
              top: BAR_Y - BALL / 2,
              width: BALL,
              height: BALL,
              pointerEvents: "auto",
            }}
            onMouseEnter={() => {
              window.companion?.setClickThrough(false);
              setHovered(item.label);
            }}
            onMouseLeave={() => {
              window.companion?.setClickThrough(true);
              setHovered(null);
            }}
          >
            <button
              onClick={item.onClick}
              title={item.label}
              className="menu-item"
              style={{
                animationDelay: `${90 + i * 40}ms`,
                width: BALL,
                height: BALL,
                borderRadius: "50%",
                border: `2px solid ${color}`,
                background: isHover ? color : "rgba(255, 252, 246, 0.9)",
                boxShadow: isHover
                  ? `0 4px 12px rgba(90, 70, 40, 0.3)`
                  : "0 2px 7px rgba(90, 70, 40, 0.18)",
                fontSize: 16,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                transition: "background 0.16s, box-shadow 0.16s",
              }}
            >
              {item.icon}
            </button>
            {/* Label appears only for the hovered item — keeps the bar clean. */}
            <div
              style={{
                position: "absolute",
                top: BALL + 9,
                left: "50%",
                transform: `translate(-50%, ${isHover ? 0 : -3}px)`,
                opacity: isHover ? 1 : 0,
                transition: "opacity 0.15s, transform 0.15s",
                fontSize: 10,
                fontFamily: "system-ui, sans-serif",
                color: "#5a4a3a",
                background: "rgba(255, 252, 246, 0.92)",
                border: "1px solid rgba(255,255,255,0.8)",
                borderRadius: 6,
                padding: "2px 7px",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                boxShadow: "0 2px 8px rgba(90, 70, 40, 0.14)",
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}

      {onSecret && (
        <button
          onClick={onSecret}
          aria-label="showcase"
          onMouseEnter={(e) => {
            window.companion?.setClickThrough(false);
            (e.currentTarget as HTMLButtonElement).style.opacity = "0.7";
          }}
          onMouseLeave={(e) => {
            window.companion?.setClickThrough(true);
            (e.currentTarget as HTMLButtonElement).style.opacity = "0.12";
          }}
          style={{
            position: "absolute",
            zIndex: 11,
            left: barX - pillW / 2 + 2,
            top: BAR_Y - 8,
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            color: "#a08e70",
            fontSize: 9,
            lineHeight: 1,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            pointerEvents: "auto",
            opacity: 0.12,
            transition: "opacity 0.2s",
          }}
        >
          ✦
        </button>
      )}

      {onDismiss && (
        <button
          onClick={onDismiss}
          title="close"
          className="menu-item"
          onMouseEnter={() => window.companion?.setClickThrough(false)}
          onMouseLeave={() => window.companion?.setClickThrough(true)}
          style={{
            position: "absolute",
            zIndex: 10,
            left: barX + dismissOffset - 11,
            top: BAR_Y - 11,
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "1.5px solid #d8c9ac",
            background: "rgba(255, 252, 246, 0.85)",
            boxShadow: "0 2px 6px rgba(90,74,58,0.12)",
            color: "#a08e70",
            fontSize: 10,
            lineHeight: 1,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            pointerEvents: "auto",
            animationDelay: `${90 + n * 40}ms`,
            transition: "background 0.16s, color 0.16s",
          }}
        >
          ✕
        </button>
      )}

      <style>{`
        /* The whole bar rises up from the plant, like a thought appearing. */
        .menu-rise {
          animation: menurise 0.3s cubic-bezier(0.3, 1.2, 0.45, 1) backwards;
        }
        @keyframes menurise {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .menu-pill {
          width: 100%;
          height: 100%;
          border-radius: 27px;
          background: linear-gradient(180deg, rgba(255,253,248,0.62), rgba(255,248,236,0.5));
          backdrop-filter: blur(16px) saturate(1.35);
          -webkit-backdrop-filter: blur(16px) saturate(1.35);
          border: 1px solid rgba(255, 255, 255, 0.72);
          box-shadow:
            0 10px 30px rgba(90, 74, 58, 0.22),
            0 2px 8px rgba(90, 74, 58, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            inset 0 -1px 0 rgba(90, 74, 58, 0.05);
        }
        /* Tooltip tail: a rotated glass square whose lower corner pokes out
           from under the pill and points at the plant (Todoist-style). */
        .menu-caret {
          background: linear-gradient(135deg, rgba(255,253,248,0.66), rgba(255,248,236,0.58));
          backdrop-filter: blur(16px) saturate(1.35);
          -webkit-backdrop-filter: blur(16px) saturate(1.35);
          border-right: 1px solid rgba(255,255,255,0.72);
          border-bottom: 1px solid rgba(255,255,255,0.72);
          border-radius: 3px;
          transform: rotate(45deg);
          box-shadow: 4px 4px 10px rgba(90, 74, 58, 0.12);
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
