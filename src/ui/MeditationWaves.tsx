import { useId } from "react";

// Fine-line ribbons are decorative, rather than an audio level meter.
// Only three groups move, keeping the mesh inexpensive to animate.
const ribbons = [0, 1, 2].map(layer => Array.from({ length: 34 }, (_, line) => {
  const depth = line / 33;
  return Array.from({ length: 121 }, (_, point) => {
    const x = -30 + point * 3.5;
    const envelope = 12 + 27 * Math.exp(-(((x - 180) / 100) ** 2));
    const phase = x / 40 + depth * 1.8 + layer * 1.9;
    const y = 53 + Math.sin(phase) * envelope * (.45 + depth * .55)
      + Math.sin(x / 23 - depth * 2 + layer) * 8;
    return `${point === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(2)}`;
  }).join(' ');
}));

export default function MeditationWaves({ playing, speed = "flowing" }: { playing: boolean; speed?: "flowing" | "slow" }) {
  const id = useId().replace(/:/g, "");
  const colours = [["#17b6c9", "#7c6bef", "#c381ef"], ["#9b72ee", "#ed7ca6", "#efb675"], ["#67c9bb", "#6da9e9", "#a486ec"]];
  return <svg viewBox="0 0 360 106" preserveAspectRatio="none" className="meditation-waves absolute inset-0 h-full w-full overflow-hidden" aria-hidden="true" data-playing={playing}>
    <defs>{colours.map((stops, layer) => <linearGradient key={layer} id={`${id}-${layer}`} x1="0" y1="0" x2="1" y2="0">
      {stops.map((colour, i) => <stop key={i} offset={i / 2} stopColor={colour} />)}
    </linearGradient>)}</defs>
    {ribbons.map((paths, layer) => <g key={layer} className="meditation-mesh" style={{ animationDelay: `${-layer * (speed === "slow" ? 3 : 1)}s`, animationDuration: `${(speed === "slow" ? 12 : 4) + layer * (speed === "slow" ? 3 : 1)}s`, transformOrigin: '180px 53px' }} fill="none" stroke={`url(#${id}-${layer})`} strokeWidth=".55" strokeOpacity={layer === 1 ? .4 : .3}>
      {paths.map((d, line) => <path key={line} d={d} />)}
    </g>)}
    <style>{`
      .meditation-mesh { animation: meditation-mesh-flow 14s ease-in-out infinite; animation-play-state: paused; }
      .meditation-waves[data-playing="true"] .meditation-mesh { animation-play-state: running; }
      @keyframes meditation-mesh-flow {
        0%,100% { transform: translateX(-9px) scaleY(.8); opacity: .8; }
        50% { transform: translateX(9px) scaleY(1.04); opacity: 1; }
      }
      @media(prefers-reduced-motion:reduce) { .meditation-mesh { animation:none; } }
    `}</style>
  </svg>;
}
