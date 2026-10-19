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

export default function MeditationWaves({ playing }: { playing: boolean }) {
  return <svg viewBox="0 0 360 106" className="meditation-waves h-[88px] w-full shrink-0 overflow-hidden text-[#6A53E7] dark:text-[#c5b9ff]" aria-hidden="true" data-playing={playing}>
    {ribbons.map((paths, layer) => <g key={layer} className="meditation-mesh" style={{ animationDelay: `${-layer * 3}s`, animationDuration: `${12 + layer * 3}s`, transformOrigin: '180px 53px' }} fill="none" stroke="currentColor" strokeWidth=".55" strokeOpacity={layer === 1 ? .3 : .16}>
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
