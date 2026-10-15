import { useEffect, useRef } from "react";

// Level-up / celebration confetti in the pot's own visual language: matte
// clay pieces (succulent paddle leaves, bloom petals, terracotta pebbles,
// cream sparkles) with soft top-left light, bursting up out of the pot and
// fluttering down. Drawn on a canvas so pieces stay crisp at any scale and
// never get baked into (or cropped by) the Kling sprites.

const SIZE = 380; // CSS px; canvas is centred over the pot rim
const DURATION = 1900;

type Kind = "leaf" | "petal" | "pebble" | "sparkle";

const PALETTE: Record<Kind, [light: string, base: string, shade: string][]> = {
  // sampled from the mascot: leaves #089808 family, pot #D84828, cheeks pink
  leaf: [
    ["#9be07a", "#4fb83a", "#2a7d22"],
    ["#b5e88f", "#68c24b", "#38862a"],
  ],
  petal: [
    ["#ffd3de", "#f59ab2", "#d9688a"],
    ["#ffe2e8", "#f7b3c4", "#df7f9d"],
  ],
  pebble: [
    ["#ff9a7a", "#e2603f", "#b23c22"],
    ["#ffb497", "#ea7653", "#c24a2c"],
  ],
  sparkle: [["#fffaf0", "#fff1cf", "#f2d48f"]],
};

interface Piece {
  kind: Kind;
  colors: [string, string, string];
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  sway: number;
  swayPhase: number;
  delay: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function spawn(reduced: boolean): Piece[] {
  const mix: Kind[] = [
    ...Array<Kind>(9).fill("leaf"),
    ...Array<Kind>(7).fill("petal"),
    ...Array<Kind>(6).fill("pebble"),
    ...Array<Kind>(4).fill("sparkle"),
  ];
  const pieces = (reduced ? mix.filter((_, i) => i % 3 === 0) : mix).map((kind) => {
    const angle = rand(-Math.PI / 2 - 1.0, -Math.PI / 2 + 1.0); // upward fan
    const speed = reduced ? rand(1.5, 2.5) : rand(5.8, 10);
    return {
      kind,
      colors: pick(PALETTE[kind]),
      x: SIZE / 2 + rand(-18, 18),
      y: SIZE * 0.5 + rand(-6, 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: rand(0, Math.PI * 2),
      vrot: rand(-0.12, 0.12),
      // chunky, like the clay pot (not paper-thin confetti)
      size: kind === "sparkle" ? rand(5, 6.5) : kind === "pebble" ? rand(5, 7.5) : rand(8.5, 12),
      sway: kind === "leaf" || kind === "petal" ? rand(0.6, 1.4) : 0,
      swayPhase: rand(0, Math.PI * 2),
      delay: rand(0, 90),
    } satisfies Piece;
  });
  return pieces;
}

/** Matte clay fill: light from the top-left, soft core shadow bottom-right. */
function clayFill(ctx: CanvasRenderingContext2D, r: number, [light, base, shade]: [string, string, string]) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.25);
  g.addColorStop(0, light);
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade);
  return g;
}

function drawPiece(ctx: CanvasRenderingContext2D, p: Piece) {
  const s = p.size;
  ctx.fillStyle = clayFill(ctx, s, p.colors);
  ctx.beginPath();
  if (p.kind === "leaf") {
    // succulent paddle: plump rounded oval, slightly fuller at the top
    ctx.ellipse(0, 0, s * 0.62, s * 1.08, 0, 0, Math.PI * 2);
  } else if (p.kind === "petal") {
    // soft teardrop
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.95, -s * 0.55, s * 0.75, s * 0.85, 0, s * 0.9);
    ctx.bezierCurveTo(-s * 0.75, s * 0.85, -s * 0.95, -s * 0.55, 0, -s);
  } else if (p.kind === "pebble") {
    ctx.arc(0, 0, s, 0, Math.PI * 2);
  } else {
    // little rounded 4-point sparkle
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.quadraticCurveTo(Math.cos(a + Math.PI / 4) * s * 0.28, Math.sin(a + Math.PI / 4) * s * 0.28, Math.cos(a + Math.PI / 2) * s, Math.sin(a + Math.PI / 2) * s);
    }
  }
  ctx.closePath();
  ctx.fill();

  // tiny specular kiss, like the pot's sheen
  if (p.kind !== "sparkle") {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(-s * 0.25, -s * (p.kind === "leaf" ? 0.5 : 0.35), s * 0.18, s * 0.12, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.kind === "leaf") {
    // centre crease
    ctx.strokeStyle = "rgba(30,90,25,0.28)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.75);
    ctx.lineTo(0, s * 0.75);
    ctx.stroke();
  }
}

export default function ClayConfetti({ burstKey }: { burstKey: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pieces = spawn(reduced);
    const start = performance.now();
    let last = start;
    let raf = 0;

    const tick = (now: number) => {
      const t = now - start;
      const dt = Math.min(2.5, (now - last) / 16.67); // frame-rate independent
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, SIZE, SIZE);
      for (const p of pieces) {
        const age = t - p.delay;
        if (age < 0) continue;
        p.vy += 0.24 * dt; // gravity
        p.vx *= Math.pow(0.986, dt); // air
        p.vy *= Math.pow(0.986, dt);
        if (p.sway) p.vy = Math.min(p.vy, 2.6); // leaves & petals float down
        p.x += (p.vx + (p.sway ? Math.sin(age / 170 + p.swayPhase) * p.sway : 0)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        const pop = Math.min(1, age / 140); // scale-in
        const fade = Math.max(0, Math.min(1, (DURATION - t) / 420));
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        // flutter: leaves/petals flip edge-on as they tumble
        const flip = p.sway ? 0.35 + 0.65 * Math.abs(Math.cos(age / 220 + p.swayPhase)) : 1;
        ctx.scale(pop * flip, pop);
        ctx.shadowColor = "rgba(60,30,20,0.18)";
        ctx.shadowBlur = 2;
        ctx.shadowOffsetY = 1;
        drawPiece(ctx, p);
        ctx.restore();
      }
      if (t < DURATION) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, SIZE, SIZE);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [burstKey]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        pointerEvents: "none",
        position: "absolute",
        left: "50%",
        top: "30%",
        width: SIZE,
        height: SIZE,
        transform: "translate(-50%, -50%)",
        zIndex: 2,
      }}
    />
  );
}
