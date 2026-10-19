import { useId } from 'react';

/** A quiet, decorative sound wave. Pauses with playback; never a fake level meter. */
export default function MeditationWaves({ playing }: { playing: boolean }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 320 86" className="meditation-waves h-[70px] w-full max-w-[280px] shrink-0" aria-hidden="true" data-playing={playing}>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a99aff"/><stop offset=".5" stopColor="#6A53E7"/><stop offset="1" stopColor="#eb9fb5"/></linearGradient>
    </defs>
    <path d="M12 43H308" stroke="#a99aff" strokeOpacity=".35"/>
    {[20,34,54,72,54,34,20].map((height,i)=><ellipse key={i} cx={46+i*38} cy="43" rx="24" ry={height/2} fill={`url(#${id})`} opacity={.4+(.3*(1-Math.abs(i-3)/3))} style={{transformOrigin:`${46+i*38}px 43px`,animationDelay:`${-i*.38}s`}} />)}
    <style>{`.meditation-waves ellipse { animation: meditation-wave 3.6s ease-in-out infinite; animation-play-state: paused; } .meditation-waves[data-playing="true"] ellipse { animation-play-state: running; } @keyframes meditation-wave { 0%,100% { transform:scaleY(.35); opacity:.35; } 50% { transform:scaleY(1); opacity:.85; } } @media(prefers-reduced-motion:reduce) { .meditation-waves ellipse { animation:none; } }`}</style>
  </svg>;
}
