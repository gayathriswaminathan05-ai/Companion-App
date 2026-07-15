// Floating circular menu. Phase 1 ("juggling"): a physically simulated
// 5-ball cascade — each ball follows a real throw-arc from hand to hand and
// rests IN a hand between throws, synced with the blob's arm rhythm.
// Phase 2 ("thrown"): the balls fly up into an arc and morph into menu
// widgets (keeping their color as a ring).
import { useEffect, useState } from "react";

export interface RadialItem {
  icon: string;
  label: string;
  onClick: () => void;
}

export type MenuPhase = "juggling" | "thrown";

const WIN_W = 320;
// The blob's hands, in window coordinates: juggle + throw origin.
const HANDS = { x: 160, y: 448 };

const BALL_COLORS = ["#FF8A7A", "#FFD75E", "#93C46F", "#7FB8E8", "#F9A8C4"];

// --- Cascade physics ---------------------------------------------------
// beat: one throw happens every BEAT seconds, hands alternating.
// Each ball flies for 3 beats, then rests ON the catching hand for 2 beats.
// Hands themselves move with the throw rhythm; resting balls ride the palm.
const BEAT = 0.36;
const HAND_CYCLE = 2 * BEAT; // each hand throws once per 2 beats
const FLIGHT = 3 * BEAT;
const CYCLE = 5 * BEAT; // each ball is re-thrown every 5 beats
const HAND_L = { x: 132, y: 452 };
const HAND_R = { x: 188, y: 452 };
const APEX = 96; // throw height in px
const PALM = 13; // ball sits this far above the hand's anchor

// Hand position over time: a lift-and-dip pulse peaking at its throw moment.
// Left hand throws at t = 0, 0.72, 1.44…; right hand offset by one beat.
function handPos(left: boolean, t: number) {
  const base = left ? HAND_L : HAND_R;
  let u = ((t + (left ? 0 : BEAT)) / HAND_CYCLE) % 1;
  if (u < 0) u += 1;
  const d = Math.min(u, 1 - u); // distance from the throw moment
  const lift = Math.exp(-(d * d) / 0.018);
  return {
    x: base.x + (left ? 13 : -13) * lift,
    y: base.y - 11 * lift,
  };
}

function ballPosition(i: number, t: number) {
  // Shift time one full cycle so all balls are in-pattern immediately.
  const since = t + CYCLE - i * BEAT;
  const k = Math.floor(since / CYCLE);
  const tt = since - k * CYCLE;
  const fromLeft = (i + k) % 2 === 0;
  const throwAt = t - tt;
  if (tt < FLIGHT) {
    const from = handPos(fromLeft, throwAt);
    const to = handPos(!fromLeft, throwAt + FLIGHT);
    const s = tt / FLIGHT;
    return {
      x: from.x + (to.x - from.x) * s,
      y: from.y - PALM - 4 * APEX * s * (1 - s),
    };
  }
  // Resting on the catching hand — rides the palm's motion exactly.
  const hand = handPos(!fromLeft, t);
  return { x: hand.x, y: hand.y - PALM };
}

export default function RadialMenu({
  items,
  phase,
  clipLeft,
  clipRight,
}: {
  items: RadialItem[];
  phase: MenuPhase;
  clipLeft: number;
  clipRight: number;
}) {
  const [jt, setJt] = useState(0);
  useEffect(() => {
    if (phase !== "juggling") return;
    const t0 = performance.now();
    const id = window.setInterval(() => setJt((performance.now() - t0) / 1000), 33);
    return () => clearInterval(id);
  }, [phase]);

  const minX = clipLeft + 28;
  const maxX = WIN_W - clipRight - 28;

  // Arc direction: rotate away from the clipped edge.
  // 90° = straight up; smaller = lean right, larger = lean left.
  const lean = Math.min(58, Math.max(-58, (clipLeft - clipRight) * 0.55));
  const center = 90 - lean;
  const n = items.length;
  const spread = Math.min(128, (n - 1) * 34);
  const angles = items.map((_, i) => center - spread / 2 + (spread * i) / Math.max(1, n - 1));

  // Arc sits right on the blob: crown ball just above the sprout,
  // outer balls tucked in beside its head.
  const positions = angles.map((a) => {
    const rad = (a * Math.PI) / 180;
    const ideal = 160 + 88 * Math.cos(rad);
    const x = Math.min(Math.max(ideal, minX), maxX);
    return { x, y: 384 - 82 * Math.sin(rad), clamped: Math.abs(x - ideal) > 1 };
  });

  // Only if a screen edge actually displaced a ball, spread collisions apart.
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const cur = positions[i];
    if (
      (cur.clamped || prev.clamped) &&
      Math.hypot(cur.x - prev.x, cur.y - prev.y) < 48
    ) {
      cur.y = prev.y + (cur.y >= prev.y ? 52 : -52);
    }
  }

  if (phase === "juggling") {
    return (
      <>
        {items.map((item, i) => {
          const p = ballPosition(i, jt);
          if (!p) return null;
          return (
            <div
              key={item.label}
              style={{
                position: "absolute",
                zIndex: 10,
                left: p.x - 15,
                top: p.y - 15,
                width: 30,
                height: 30,
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

  return (
    <>
      {items.map((item, i) => {
        const p = positions[i];
        const color = BALL_COLORS[i % BALL_COLORS.length];
        return (
          <div
            key={item.label}
            style={{
              position: "absolute",
              zIndex: 10,
              left: p.x - 26,
              top: p.y - 26,
              width: 52,
              textAlign: "center",
              pointerEvents: "auto",
            }}
            onMouseEnter={() => window.companion?.setClickThrough(false)}
            onMouseLeave={() => window.companion?.setClickThrough(true)}
          >
            <button
              onClick={item.onClick}
              title={item.label}
              className="juggle-ball"
              style={
                {
                  "--ball": color,
                  "--sx": `${HANDS.x - p.x}px`,
                  "--sy": `${HANDS.y - 20 - p.y}px`,
                  animationDelay: `${i * 50}ms`,
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  border: `2.5px solid ${color}`,
                  background: "rgba(255, 250, 240, 0.97)",
                  boxShadow: "0 3px 10px rgba(90, 70, 40, 0.25)",
                  fontSize: 20,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                } as React.CSSProperties
              }
            >
              <span className="ball-icon" style={{ animationDelay: `${i * 50 + 250}ms` }}>
                {item.icon}
              </span>
            </button>
            <div
              className="juggle-label"
              style={{
                animationDelay: `${i * 50 + 360}ms`,
                marginTop: 2,
                fontSize: 10,
                fontFamily: "system-ui, sans-serif",
                color: "#5a4a3a",
                background: "rgba(255, 250, 240, 0.92)",
                borderRadius: 6,
                padding: "1px 5px",
                display: "inline-block",
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
      <style>{`
        /* Thrown: starts as a solid colored ball at the hands, morphs into a
           cream widget with a colored ring as it lands. */
        .juggle-ball {
          animation: throwup 0.48s cubic-bezier(0.25, 1.12, 0.4, 1) backwards;
        }
        @keyframes throwup {
          0%   { transform: translate(var(--sx), var(--sy)) scale(0.68); background: var(--ball); }
          55%  { background: var(--ball); }
          85%  { background: rgba(255, 250, 240, 0.97); }
          100% { transform: translate(0, 0) scale(1); background: rgba(255, 250, 240, 0.97); }
        }
        .ball-icon {
          animation: iconfade 0.3s ease-out backwards;
        }
        @keyframes iconfade {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        .juggle-label {
          animation: labelfade 0.3s ease-out backwards;
        }
        @keyframes labelfade {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
