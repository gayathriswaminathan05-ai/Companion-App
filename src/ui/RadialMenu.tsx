// Floating menu, v3: cascade-juggle → throw up → merge → glass bar.
// Phase "juggling": the blob plays its hands-up gesture clip while the balls
// run a real cascade (throw-arcs hand to hand) in front of it — the physics
// from the original placeholder animation, retuned to the sprite's hands.
// Phase "thrown": balls fly up and converge into ONE brown ball above its
// head, then a frosted-glass pill stretches sideways and they spread into
// menu slots (her Pinterest reference).
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

// The sprite's raised hands, measured from the conducting-gesture frames
// (the body sits LEFT of the window center — its vines hang to the right).
const HAND_L = { x: 91, y: 430 };
const HAND_R = { x: 174, y: 428 };
const BODY_X = 132; // the body's visual centerline — juggle + bar align to it

const BAR_Y = 286; // bar + merge point: snug above the blob's head
const SLOT = 52; // horizontal distance between ball centers in the bar
const BALL = 38; // ball size inside the bar
const PILL_PAD = 12;

// --- Fountain physics (proper 4-ball juggling) ---------------------------
// Each hand juggles its own TWO balls straight up-down (no crossing) —
// which is real four-ball technique AND matches the sprite's alternating
// left-up / right-down hand gesture.
const BEAT = 0.34;
const HAND_CYCLE = 2 * BEAT; // a hand throws one of its balls every 2 beats
const FLIGHT = 3 * BEAT; // ball airtime; then it rests 1 beat in the palm
const APEX = 80; // throw height
const PALM = 13; // ball rides this far above the hand anchor

function handPos(left: boolean, t: number) {
  const base = left ? HAND_L : HAND_R;
  let u = ((t + (left ? 0 : BEAT)) / HAND_CYCLE) % 1;
  if (u < 0) u += 1;
  const d = Math.min(u, 1 - u);
  const lift = Math.exp(-(d * d) / 0.018);
  return {
    x: base.x + (left ? 9 : -9) * lift,
    y: base.y - 10 * lift,
  };
}

function ballPosition(i: number, t: number) {
  const left = i % 2 === 0; // balls 0,2 → left hand; 1,3 → right hand
  const j = Math.floor(i / 2); // which of that hand's two balls
  const per = 4 * BEAT; // each ball is re-thrown every 4 beats
  const offset = (left ? 0 : BEAT) + j * 2 * BEAT;
  const since = t + per - offset;
  const k = Math.floor(since / per);
  const tt = since - k * per;
  const throwAt = t - tt;
  if (tt < FLIGHT) {
    const from = handPos(left, throwAt);
    const to = handPos(left, throwAt + FLIGHT);
    const s = tt / FLIGHT;
    return {
      // small inward loop on the way up so the two balls of a hand don't
      // ride the exact same column
      x: from.x + (to.x - from.x) * s + (left ? 1 : -1) * 9 * Math.sin(Math.PI * s),
      y: from.y - PALM - 4 * APEX * s * (1 - s),
    };
  }
  const hand = handPos(left, t);
  return { x: hand.x, y: hand.y - PALM };
}

export default function RadialMenu({
  items,
  phase,
  clipLeft,
  clipRight,
  onDismiss,
  onSecret,
}: {
  items: RadialItem[];
  phase: MenuPhase;
  clipLeft: number;
  clipRight: number;
  onDismiss?: () => void;
  onSecret?: () => void;
}) {
  const [jt, setJt] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  // "thrown" runs in two beats: "up" (balls fly up and merge) then "bar".
  const [sub, setSub] = useState<"up" | "bar">("up");

  useEffect(() => {
    if (phase !== "juggling") return;
    const t0 = performance.now();
    const id = window.setInterval(() => setJt((performance.now() - t0) / 1000), 33);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "thrown") {
      setSub("up");
      return;
    }
    const id = window.setTimeout(() => setSub("bar"), 300);
    return () => clearTimeout(id);
  }, [phase]);

  const n = items.length;
  // The ✕ lives INSIDE the pill, after the last ball (slightly tighter slot).
  const dismissGap = onDismiss ? 44 : 0;
  const pillW =
    PILL_PAD + BALL / 2 + (n - 1) * SLOT + dismissGap + (onDismiss ? 11 : BALL / 2) + PILL_PAD;

  // Keep the whole bar inside the visible part of the window, wherever the
  // blob has been parked on screen.
  const visL = clipLeft + 5;
  const visR = WIN_W - clipRight - 5;
  let barX = Math.min(Math.max(BODY_X, visL + pillW / 2), visR - pillW / 2);
  // If space is impossibly tight, center the pill in what's visible.
  if (visR - visL < pillW) barX = (visL + visR) / 2;

  // Offsets from the pill's center: balls first, ✕ after the last ball.
  const firstBall = -pillW / 2 + PILL_PAD + BALL / 2;
  const offsets = items.map((_, i) => firstBall + i * SLOT);
  const dismissOffset = firstBall + (n - 1) * SLOT + dismissGap;

  // --- Phase 1: cascade juggle in front of the blob ----------------------
  if (phase === "juggling") {
    return (
      <>
        {items.map((item, i) => {
          const p = ballPosition(i, jt);
          return (
            <div
              key={item.label}
              style={{
                position: "absolute",
                zIndex: 10,
                left: p.x - 14,
                top: p.y - 14,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.65), rgba(255,255,255,0) 42%), ${BALL_COLORS[i % BALL_COLORS.length]}`,
                boxShadow: "0 3px 8px rgba(90, 70, 40, 0.3)",
                pointerEvents: "none",
                opacity: Math.min(1, jt / 0.25),
              }}
            />
          );
        })}
      </>
    );
  }

  // --- Phase 2a: throw up — balls converge into one above the head -------
  if (sub === "up") {
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
                  "--dy": `${BAR_Y - (hand.y - PALM)}px`,
                  position: "absolute",
                  zIndex: 10,
                  left: hand.x - 14,
                  top: hand.y - PALM - 14,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  pointerEvents: "none",
                  animationDelay: `${i * 40}ms`,
                } as React.CSSProperties
              }
            />
          );
        })}
        <style>{`
          .gather-ball {
            background: var(--c0);
            box-shadow: 0 3px 8px rgba(90, 70, 40, 0.3);
            animation: gather 0.26s cubic-bezier(0.3, 0.9, 0.35, 1.08) forwards;
          }
          @keyframes gather {
            0%   { transform: translate(0, 0) scale(1); background: var(--c0); }
            70%  { background: var(--c0); }
            100% { transform: translate(var(--dx), var(--dy)) scale(1); background: ${MERGE}; }
          }
        `}</style>
      </>
    );
  }

  // --- Phase 2b: merged ball pops into the glass bar ---------------------
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
              className="menu-ball"
              style={
                {
                  "--ball": color,
                  "--slot": `${offsets[i]}px`,
                  animationDelay: `${40 + i * 26}ms`,
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
              <span className="menu-icon" style={{ animationDelay: `${180 + i * 26}ms` }}>
                {item.icon}
              </span>
            </button>
            {/* Label appears only for the hovered ball — keeps the bar clean. */}
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
          className="menu-secret"
          onMouseEnter={() => window.companion?.setClickThrough(false)}
          onMouseLeave={() => window.companion?.setClickThrough(true)}
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
          onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.7")}
          onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.12")}
        >
          ✦
        </button>
      )}

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
            transition: "background 0.16s, color 0.16s",
          }}
        >
          ✕
        </button>
      )}

      <style>{`
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
          animation: pillgrow 0.32s cubic-bezier(0.3, 1.25, 0.45, 1) 0.04s backwards;
        }
        @keyframes pillgrow {
          from { transform: scaleX(0.16) scaleY(0.62); opacity: 0.4; }
          to   { transform: scaleX(1) scaleY(1); opacity: 1; }
        }
        .menu-ball {
          animation: spreadout 0.32s cubic-bezier(0.3, 1.2, 0.4, 1) backwards;
        }
        @keyframes spreadout {
          0%   { transform: translate(calc(var(--slot) * -1), 0) scale(0.74); background: ${MERGE}; border-color: ${MERGE}; }
          38%  { background: ${MERGE}; border-color: ${MERGE}; }
          100% { transform: translate(0, 0) scale(1); background: rgba(255, 252, 246, 0.9); border-color: var(--ball); }
        }
        .menu-icon {
          animation: iconfade 0.22s ease-out backwards;
        }
        @keyframes iconfade {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }
        .menu-dismiss {
          animation: iconfade 0.22s ease-out 0.3s backwards;
        }
        .menu-dismiss:hover {
          color: #5a4a3a;
        }
      `}</style>
    </>
  );
}
