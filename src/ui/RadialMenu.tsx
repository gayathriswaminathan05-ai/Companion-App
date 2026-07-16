// Floating menu, v2 ("merge & spread", after her Pinterest reference).
// Phase 1 ("juggling"): the blob hops; the balls launch off it and converge
// on one spot above its head, tinting to warm brown so they read as ONE ball.
// Phase 2 ("thrown"): the merged ball bounces once, then a frosted-glass pill
// stretches out of it sideways while the balls slide apart into menu slots.
import { useEffect, useState } from "react";

export interface RadialItem {
  icon: string;
  label: string;
  onClick: () => void;
}

export type MenuPhase = "juggling" | "thrown";

const WIN_W = 320;
const BALL_COLORS = ["#FF8A7A", "#FFD75E", "#93C46F", "#7FB8E8", "#F9A8C4"];
const MERGE = "#5a4a3a"; // the "one ball" color — Blob's warm text-brown

// Balls leave from the blob's raised hands (it plays its tossing-gesture
// clip during this phase) — alternating left / right like real throws.
const HAND_L = { x: 128, y: 398 };
const HAND_R = { x: 192, y: 398 };
const BAR_Y = 268; // bar (and merge point) center, above the blob's head
const SLOT = 52; // horizontal distance between ball centers in the bar
const BALL = 38; // ball size inside the bar
const PILL_PAD = 12;

export default function RadialMenu({
  items,
  phase,
  clipLeft,
  clipRight,
  onDismiss,
}: {
  items: RadialItem[];
  phase: MenuPhase;
  clipLeft: number;
  clipRight: number;
  onDismiss?: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const n = items.length;
  const pillW = n * BALL + (n - 1) * (SLOT - BALL) + PILL_PAD * 2;
  const dismissW = onDismiss ? 30 : 0; // little ✕ floating off the right end
  // Keep the whole bar on-screen when the window hangs off a display edge.
  const barX = Math.min(
    Math.max(160, clipLeft + pillW / 2 + 6),
    WIN_W - clipRight - pillW / 2 - 6 - dismissW,
  );

  // Ball slot offsets from the bar center.
  const offsets = items.map((_, i) => (i - (n - 1) / 2) * SLOT);

  if (phase === "juggling") {
    // Launch: each ball flies from the blob up to the merge point, tinting
    // to the merge brown on the way. Staggered so it feels tossed, not shot.
    return (
      <>
        {items.map((item, i) => {
          const hand = i % 2 === 0 ? HAND_L : HAND_R;
          return (
            <div
              key={item.label}
              className="gather-ball"
              style={
                {
                  "--c0": BALL_COLORS[i % BALL_COLORS.length],
                  "--dx": `${barX - hand.x}px`,
                  "--dy": `${BAR_Y - hand.y}px`,
                  position: "absolute",
                  zIndex: 10,
                  left: hand.x - 14,
                  top: hand.y - 14,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  pointerEvents: "none",
                  animationDelay: `${i * 90}ms`,
                } as React.CSSProperties
              }
            />
          );
        })}
        <style>{`
          .gather-ball {
            background: var(--c0);
            box-shadow: 0 3px 8px rgba(90, 70, 40, 0.3);
            animation: gather 0.42s cubic-bezier(0.3, 0.9, 0.35, 1.08) forwards;
            opacity: 0;
          }
          @keyframes gather {
            0%   { transform: translate(0, 0) scale(0.55); opacity: 0; background: var(--c0); }
            18%  { opacity: 1; }
            70%  { background: var(--c0); }
            100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 1; background: ${MERGE}; }
          }
        `}</style>
      </>
    );
  }

  // Phase "thrown": merged ball bounces, glass pill stretches, balls spread.
  return (
    <>
      <div
        style={{
          position: "absolute",
          zIndex: 9,
          left: barX - pillW / 2,
          top: BAR_Y - 27,
          width: pillW,
          height: 54,
          pointerEvents: "none",
        }}
      >
        {/* Frosted-glass pill */}
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
              left: barX - BALL / 2,
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
              className="menu-ball"
              style={
                {
                  "--ball": color,
                  "--slot": `${offsets[i]}px`,
                  animationDelay: `${170 + i * 28}ms`,
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
                } as React.CSSProperties
              }
            >
              <span className="menu-icon" style={{ animationDelay: `${330 + i * 28}ms` }}>
                {item.icon}
              </span>
            </button>
            {/* Label appears only for the hovered ball — keeps the bar clean. */}
            <div
              style={{
                position: "absolute",
                top: BALL + 9,
                left: "50%",
                transform: `translate(calc(-50% + ${offsets[i]}px), ${isHover ? 0 : -3}px)`,
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

      {onDismiss && (
        <button
          onClick={onDismiss}
          title="close"
          className="menu-dismiss"
          onMouseEnter={() => window.companion?.setClickThrough(false)}
          onMouseLeave={() => window.companion?.setClickThrough(true)}
          style={{
            position: "absolute",
            zIndex: 10,
            left: barX + pillW / 2 + 8,
            top: BAR_Y - 11,
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.72)",
            background: "linear-gradient(180deg, rgba(255,253,248,0.62), rgba(255,248,236,0.5))",
            backdropFilter: "blur(16px) saturate(1.35)",
            WebkitBackdropFilter: "blur(16px) saturate(1.35)",
            boxShadow: "0 4px 12px rgba(90,74,58,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
            color: "#a08e70",
            fontSize: 10,
            lineHeight: 1,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            pointerEvents: "auto",
          }}
        >
          ✕
        </button>
      )}

      <style>{`
        /* The merged ball's bounce, then the pill stretching out of it. */
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
          animation: pillgrow 0.32s cubic-bezier(0.3, 1.25, 0.45, 1) 0.16s backwards;
        }
        @keyframes pillgrow {
          from { transform: scaleX(0.16) scaleY(0.62); opacity: 0.4; }
          to   { transform: scaleX(1) scaleY(1); opacity: 1; }
        }
        /* Each ball: starts as the merged brown ball (bounce), slides to its
           slot while morphing to its own color ring on cream. */
        .menu-ball {
          animation: spreadout 0.34s cubic-bezier(0.3, 1.2, 0.4, 1) backwards;
        }
        @keyframes spreadout {
          0%   { transform: translate(0, 0) scale(0.74); background: ${MERGE}; border-color: ${MERGE}; }
          38%  { background: ${MERGE}; border-color: ${MERGE}; }
          100% { transform: translate(var(--slot), 0) scale(1); background: rgba(255, 252, 246, 0.9); border-color: var(--ball); }
        }
        .menu-ball { transform: translate(var(--slot), 0); }
        .menu-icon {
          animation: iconfade 0.22s ease-out backwards;
        }
        .menu-dismiss {
          animation: iconfade 0.22s ease-out 0.42s backwards;
        }
        .menu-dismiss:hover {
          color: #5a4a3a;
        }
        @keyframes iconfade {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}
