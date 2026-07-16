import { useEffect, useRef, useState } from "react";
import type { CharacterState, SproutStage } from "./types";
import { SPRITES, SpriteAnim as SpriteAnimDef } from "../generated/sprites";

// Plays AI-generated frame animations (ping-pong loop) for states that have
// them; all other states fall back to the procedural drawing below.
function SpriteAnim({ anim }: { anim: SpriteAnimDef }) {
  const [idx, setIdx] = useState(0);
  const dirRef = useRef(1);

  // Show every state at the same TRUE character scale: a clip cropped to a
  // bigger source box (e.g. covering swing travel) packs the character smaller
  // into its frames, so we compensate relative to idle's crop box.
  const base = SPRITES.idle;
  let scale = 1;
  if (anim !== base && anim.srcW && anim.srcH && base?.srcW && base?.srcH) {
    const fit = (a: SpriteAnimDef) => Math.min(340 / a.srcW!, 400 / a.srcH!);
    scale = Math.max(0.7, Math.min(1.45, fit(base) / fit(anim)));
  }

  useEffect(() => {
    // Restart from the first frame whenever the state (clip) changes, so
    // gesture clips (juggling, dragged) always play from their beginning.
    setIdx(0);
    dirRef.current = 1;
    // Preload every frame once so playback never flickers.
    for (const src of anim.frames) {
      const img = new Image();
      img.src = src;
    }
    const timer = window.setInterval(() => {
      setIdx((i) => {
        let next = i + dirRef.current;
        if (anim.pingpong) {
          if (next >= anim.frames.length) {
            dirRef.current = -1;
            next = anim.frames.length - 2;
          } else if (next < 0) {
            dirRef.current = 1;
            next = 1;
          }
        } else {
          next = next % anim.frames.length;
        }
        return Math.max(0, Math.min(anim.frames.length - 1, next));
      });
    }, 1000 / anim.fps);
    return () => clearInterval(timer);
  }, [anim]);

  return (
    <img
      src={anim.frames[idx]}
      width={170}
      height={200}
      draggable={false}
      style={{
        objectFit: "contain",
        objectPosition: "bottom center",
        display: "block",
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "bottom center",
      }}
      alt=""
    />
  );
}

// Procedural placeholder character. The state machine + this component's
// state->pose mapping survive when real sprite art replaces the drawing.

function Sprout({ stage }: { stage: SproutStage }) {
  return (
    <g className="sprout-pop" key={stage}>
      {stage === "bud" && (
        <>
          <path d="M85 74 Q84.5 68 84 64" fill="none" stroke="#6FA050" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="84" cy="61" r="5.5" fill="#93C46F" />
        </>
      )}
      {(stage === "leaf" || stage === "leaves" || stage === "bloom") && (
        <>
          <path d="M85 74 Q83 61 76 54" fill="none" stroke="#6FA050" strokeWidth="4" strokeLinecap="round" />
          <path d="M76 54 Q60 40 46 47 Q54 63 71 58 Q75 56 76 54 Z" fill="#7FB25B" />
        </>
      )}
      {(stage === "leaves" || stage === "bloom") && (
        <path d="M77 53 Q84 36 100 36 Q97 55 80 57 Q78 55 77 53 Z" fill="#93C46F" />
      )}
      {stage === "bloom" && (
        <g>
          <path d="M77 52 Q73 44 73 38" fill="none" stroke="#6FA050" strokeWidth="3" strokeLinecap="round" />
          <circle cx="67" cy="34" r="5" fill="#F9A8C4" />
          <circle cx="79" cy="34" r="5" fill="#F9A8C4" />
          <circle cx="73" cy="27" r="5" fill="#F9A8C4" />
          <circle cx="73" cy="35" r="4" fill="#FFE08A" />
        </g>
      )}
    </g>
  );
}

function Eyes({ state, blink }: { state: CharacterState; blink: boolean }) {
  const closed = state === "sleeping" || blink;
  const happy = state === "celebrating" || state === "waving" || state === "watering";
  const wide = state === "dragged";
  const up = state === "thinking" || state === "juggling"; // watching the balls

  if (closed)
    return (
      <g>
        <path d="M55 118 Q62 123 69 118" fill="none" stroke="#4A3226" strokeWidth="3" strokeLinecap="round" />
        <path d="M101 118 Q108 123 115 118" fill="none" stroke="#4A3226" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  if (happy)
    return (
      <g>
        <path d="M55 120 Q62 112 69 120" fill="none" stroke="#4A3226" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M101 120 Q108 112 115 120" fill="none" stroke="#4A3226" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    );
  if (wide)
    return (
      <g>
        <circle cx="62" cy="117" r="8.5" fill="#4A3226" />
        <circle cx="108" cy="117" r="8.5" fill="#4A3226" />
        <circle cx="65" cy="113.5" r="2.6" fill="#fff" />
        <circle cx="111" cy="113.5" r="2.6" fill="#fff" />
      </g>
    );
  const down = state === "writing" || state === "noting"; // eyes on the notebook
  const dx = up ? -2 : 0;
  const dy = up ? -3 : down ? 3.5 : 0;
  return (
    <g>
      <circle cx={62 + dx} cy={118 + dy} r="6.5" fill="#4A3226" />
      <circle cx={108 + dx} cy={118 + dy} r="6.5" fill="#4A3226" />
      <circle cx={64.5 + dx} cy={115.5 + dy} r="2" fill="#fff" />
      <circle cx={110.5 + dx} cy={115.5 + dy} r="2" fill="#fff" />
    </g>
  );
}

function Mouth({ state }: { state: CharacterState }) {
  if (state === "dragged") return <circle cx="85" cy="139" r="5" fill="#4A3226" />;
  if (state === "celebrating")
    return <path d="M74 134 Q85 148 96 134 Z" fill="#4A3226" stroke="#4A3226" strokeWidth="2" strokeLinejoin="round" />;
  return <path d="M76 136 Q85 144 94 136" fill="none" stroke="#4A3226" strokeWidth="3" strokeLinecap="round" />;
}

// Lying-on-its-side sleeping pose: head to the left, feet to the right,
// z's drifting up from its mouth.
function AsleepBody({ sproutStage }: { sproutStage: SproutStage }) {
  return (
    <g>
      <ellipse cx="88" cy="154" rx="76" ry="42" fill="#FFCF96" />
      <ellipse cx="102" cy="168" rx="46" ry="22" fill="#FFF3DF" />
      <ellipse cx="160" cy="142" rx="8" ry="6.5" fill="#F5B87E" />
      <ellipse cx="163" cy="160" rx="8" ry="6.5" fill="#F5B87E" />

      <g transform="translate(-55,50) rotate(-24 85 74)">
        <Sprout stage={sproutStage} />
      </g>

      <path d="M34 140 Q40 144 46 140" fill="none" stroke="#4A3226" strokeWidth="3" strokeLinecap="round" />
      <path d="M58 138 Q64 142 70 138" fill="none" stroke="#4A3226" strokeWidth="3" strokeLinecap="round" />
      <circle cx="51" cy="156" r="3.5" fill="#4A3226" />
      <ellipse cx="30" cy="154" rx="8" ry="5.5" fill="#F7A98F" />

      <g fill="#A8B8D0" fontFamily="system-ui, sans-serif" fontWeight="600">
        <text className="zz z1" x="40" y="122" fontSize="17">z</text>
        <text className="zz z2" x="28" y="103" fontSize="13">z</text>
        <text className="zz z3" x="19" y="87" fontSize="10">z</text>
      </g>
    </g>
  );
}

export default function Blob({
  state,
  sproutStage,
  scribbling = false,
}: {
  state: CharacterState;
  sproutStage: SproutStage;
  // In the persistent "noting" pose: pen moves only while the user is
  // actively typing or speaking.
  scribbling?: boolean;
}) {
  const [blink, setBlink] = useState(false);
  const [wiggle, setWiggle] = useState(false);
  const [sleepPhase, setSleepPhase] = useState<"yawn" | "asleep">("yawn");
  const svgRef = useRef<SVGSVGElement>(null);

  // Sleeping is a sequence: yawn first, then flop over and sleep.
  useEffect(() => {
    if (state !== "sleeping") return;
    setSleepPhase("yawn");
    const t = window.setTimeout(() => setSleepPhase("asleep"), 1700);
    return () => clearTimeout(t);
  }, [state]);

  // Random blinking while awake.
  useEffect(() => {
    if (state === "sleeping") return;
    let alive = true;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        window.setTimeout(() => alive && setBlink(false), 140);
        loop();
      }, 2500 + Math.random() * 3500);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [state]);

  // Occasional idle wiggle so it never looks like a looped GIF.
  useEffect(() => {
    if (state !== "idle") return;
    let alive = true;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        if (!alive) return;
        setWiggle(true);
        window.setTimeout(() => alive && setWiggle(false), 900);
        loop();
      }, 9000 + Math.random() * 12000);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [state]);

  const asleep = state === "sleeping" && sleepPhase === "asleep";
  const yawning = state === "sleeping" && sleepPhase === "yawn";

  // Low-frequency ticker (~12fps) drives the perpetual poses cheaply.
  // Short-lived poses stay on 60fps CSS for smoothness.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    if (state === "listening") {
      el.style.transform = "rotate(-4deg) scale(1.03)";
      return () => {
        el.style.transform = "";
      };
    }
    const perpetual = state === "idle" || state === "noting" || asleep || state === "thinking";
    if (!perpetual) {
      el.style.transform = "";
      return;
    }
    const t0 = performance.now();
    const timer = window.setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      if (state === "idle" || state === "noting") {
        const p = Math.cos((2 * Math.PI * t) / 3.2);
        el.style.transform = `scaleX(${1.006 - 0.006 * p}) scaleY(${0.985 + 0.015 * p})`;
      } else if (asleep) {
        const p = Math.cos((2 * Math.PI * t) / 4.6);
        el.style.transform = `scaleY(${1.005 + 0.02 * p})`;
      } else {
        el.style.transform = `rotate(${1.5 * Math.sin((2 * Math.PI * t) / 3)}deg)`;
      }
    }, 85);
    return () => {
      clearInterval(timer);
      el.style.transform = "";
    };
  }, [state, asleep]);

  const pose = yawning ? "yawning" : asleep ? "asleep" : state;
  const cls = `pose-${pose}${wiggle && state === "idle" ? " wiggling" : ""}${state === "noting" && scribbling ? " scribbling" : ""}`;

  // AI-generated animation available for this state? Use it.
  const sprite = SPRITES[state];
  if (sprite && sprite.frames.length > 0) {
    return <SpriteAnim anim={sprite} />;
  }

  return (
    <svg ref={svgRef} viewBox="0 0 170 200" width="170" height="200" className={cls}>
      {asleep ? (
        <AsleepBody sproutStage={sproutStage} />
      ) : (
        <g>
          <g className="body-anim">
            <ellipse cx="85" cy="130" rx="70" ry="58" fill="#FFCF96" />
            <ellipse cx="85" cy="150" rx="44" ry="33" fill="#FFF3DF" />
            <ellipse cx="65" cy="192" rx="13" ry="7" fill="#F5B87E" />
            <ellipse cx="105" cy="192" rx="13" ry="7" fill="#F5B87E" />

            <g className="arm arm-l">
              <rect x="8" y="132" width="20" height="44" rx="10" fill="#FFCF96" />
              <circle cx="18" cy="178" r="10" fill="#FFCF96" />
              <circle cx="10.5" cy="185" r="4" fill="#FFCF96" />
              <circle cx="18" cy="188.5" r="4" fill="#FFCF96" />
              <circle cx="25.5" cy="185" r="4" fill="#FFCF96" />
            </g>
            <g className="arm arm-r">
              <rect x="142" y="132" width="20" height="44" rx="10" fill="#FFCF96" />
              <circle cx="152" cy="178" r="10" fill="#FFCF96" />
              <circle cx="144.5" cy="185" r="4" fill="#FFCF96" />
              <circle cx="152" cy="188.5" r="4" fill="#FFCF96" />
              <circle cx="159.5" cy="185" r="4" fill="#FFCF96" />
            </g>

            <Sprout stage={sproutStage} />
            <Eyes state={state} blink={blink} />

            {(state === "writing" || state === "noting") && (
              <g className="specs">
                <line x1="50" y1="115" x2="22" y2="106" stroke="#8a6d4a" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="120" y1="115" x2="148" y2="106" stroke="#8a6d4a" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="62" cy="119" r="13" fill="rgba(190, 216, 240, 0.28)" stroke="#8a6d4a" strokeWidth="2.5" />
                <circle cx="108" cy="119" r="13" fill="rgba(190, 216, 240, 0.28)" stroke="#8a6d4a" strokeWidth="2.5" />
                <path d="M75 117 Q85 111 95 117" fill="none" stroke="#8a6d4a" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M53 112 Q57 108 62 108" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" opacity="0.75" />
              </g>
            )}

            {yawning ? (
              <g>
                <ellipse cx="85" cy="141" rx="11" ry="14" fill="#4A3226" />
                <ellipse cx="85" cy="147" rx="6" ry="5" fill="#E8837E" />
              </g>
            ) : (
              <Mouth state={state} />
            )}

            <ellipse cx="45" cy="134" rx="10" ry="6.5" fill="#F7A98F" />
            <ellipse cx="125" cy="134" rx="10" ry="6.5" fill="#F7A98F" />

            {state === "watering" && (
              <g>
                <g className="cup">
                  <rect x="106" y="18" width="24" height="28" rx="4" fill="#BFE0F5" stroke="#8FBEE0" strokeWidth="2" />
                  <rect x="109" y="26" width="18" height="17" rx="2" fill="#7FB8E8" opacity="0.85" />
                </g>
                <circle className="drop dr1" cx="99" cy="38" r="3.2" fill="#7FB8E8" />
                <circle className="drop dr2" cx="95" cy="34" r="2.6" fill="#7FB8E8" />
                <circle className="drop dr3" cx="103" cy="35" r="2.4" fill="#7FB8E8" />
                <ellipse className="splash" cx="85" cy="66" rx="9" ry="2.5" fill="#A8D4F0" opacity="0" />
              </g>
            )}

            {(state === "writing" || state === "noting") && (
              <g className="notebook">
                <rect x="55" y="146" width="60" height="38" rx="5" fill="#FFFFFF" stroke="#E0D5C0" strokeWidth="2" transform="rotate(-4 85 165)" />
                <path className="scribble" d="M64 156 Q75 153 86 156 T106 155 M64 165 Q76 162 88 165 T105 164 M64 174 Q74 171 84 174" fill="none" stroke="#B9A98F" strokeWidth="2.5" strokeLinecap="round" transform="rotate(-4 85 165)" />
                <g className="pencil">
                  <rect x="98" y="138" width="6" height="26" rx="2" fill="#F2B33D" transform="rotate(35 101 151)" />
                  <path d="M96 162 L100 170 L104 162 Z" fill="#8A6D4A" transform="rotate(35 101 151)" />
                </g>
              </g>
            )}
          </g>

          {state === "thinking" && (
            <g fill="#C9BCA6">
              <circle className="dot d1" cx="112" cy="72" r="4" />
              <circle className="dot d2" cx="124" cy="60" r="5" />
              <circle className="dot d3" cx="138" cy="46" r="6" />
            </g>
          )}

          {state === "celebrating" && (
            <g fill="#FFD75E">
              <path className="spark s1" d="M30 70 L34 78 L42 82 L34 86 L30 94 L26 86 L18 82 L26 78 Z" />
              <path className="spark s2" d="M138 46 L141 52 L147 55 L141 58 L138 64 L135 58 L129 55 L135 52 Z" />
              <path className="spark s3" d="M128 150 L131 156 L137 159 L131 162 L128 168 L125 162 L119 159 L125 156 Z" />
            </g>
          )}
        </g>
      )}

      <style>{`
        /* Perpetual poses (idle/asleep/thinking) are driven by the JS ticker.
           Short-lived poses below stay on smooth 60fps CSS. */
        svg { transform-origin: 50% 95%; will-change: transform; }

        svg.pose-idle.wiggling { animation: wiggle 0.9s ease-in-out; }
        svg.pose-yawning { animation: yawnstretch 1.7s ease-in-out; }
        svg.pose-waking { animation: wakeup 1.4s ease-out; }
        svg.pose-waving { animation: rock 1.1s ease-in-out infinite; }
        svg.pose-celebrating { animation: hop 0.65s ease-in-out infinite; }
        svg.pose-writing { animation: writebob 1.2s ease-in-out infinite; }
        svg.pose-stretching { animation: waistbend 2.8s ease-in-out; }
        svg.pose-stretching .arm-l { animation: pumpL 0.7s ease-in-out infinite; }
        svg.pose-stretching .arm-r { animation: pumpR 0.7s ease-in-out infinite; }
        @keyframes waistbend {
          0%   { transform: none; }
          12%  { transform: scaleY(1.09) scaleX(0.95); }
          32%  { transform: rotate(-9deg) scaleY(1.04); }
          52%  { transform: rotate(9deg) scaleY(1.04); }
          70%  { transform: rotate(-7deg) scaleY(1.02); }
          86%  { transform: rotate(6deg); }
          100% { transform: none; }
        }
        @keyframes pumpL { 0%,100% { transform: rotate(-152deg); } 50% { transform: rotate(-114deg); } }
        @keyframes pumpR { 0%,100% { transform: rotate(152deg); } 50% { transform: rotate(114deg); } }

        /* Watering: right arm holds the cup tipped over the head-sprout. */
        svg.pose-watering { animation: watersway 2.4s ease-in-out infinite; }
        svg.pose-watering .arm-r { transform: rotate(168deg); }
        @keyframes watersway { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.985) scaleX(1.008); } }
        .cup { transform-origin: 118px 40px; animation: cuptip 2.4s ease-in-out infinite; }
        @keyframes cuptip {
          0%, 15%  { transform: rotate(-18deg); }
          35%, 75% { transform: rotate(-42deg); }
          95%, 100% { transform: rotate(-18deg); }
        }
        .drop { animation: dropfall 0.8s linear infinite; opacity: 0; }
        .dr2 { animation-delay: 0.25s; }
        .dr3 { animation-delay: 0.5s; }
        @keyframes dropfall {
          0%   { opacity: 0; transform: translate(0, 0); }
          15%  { opacity: 1; }
          100% { opacity: 0.2; transform: translate(-13px, 26px); }
        }
        .splash { animation: splashpulse 0.8s ease-out infinite; }
        @keyframes splashpulse {
          0%, 55% { opacity: 0; transform: scaleX(0.5); }
          70%  { opacity: 0.85; transform: scaleX(1.15); }
          100% { opacity: 0; transform: scaleX(1.35); }
        }
        svg.pose-dragged { animation: dangle 0.5s ease-in-out infinite; }

        @keyframes wiggle { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
        @keyframes yawnstretch { 0% { transform: scaleY(1); } 30% { transform: scaleY(1.09) scaleX(0.95) rotate(-2deg); } 65% { transform: scaleY(1.06) scaleX(0.97) rotate(-1deg); } 100% { transform: scaleY(0.94) scaleX(1.04); } }
        @keyframes wakeup { 0% { transform: scaleY(0.6) scaleX(1.25); } 55% { transform: scaleY(1.08) scaleX(0.96); } 80% { transform: scaleY(0.97) scaleX(1.02); } 100% { transform: scaleY(1); } }
        @keyframes rock { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
        @keyframes hop { 0%,100% { transform: translateY(0) scaleY(1); } 35% { transform: translateY(-16px) scaleY(1.1) scaleX(0.95); } 70% { transform: translateY(0) scaleY(0.94) scaleX(1.05); } }
        @keyframes writebob { 0%,100% { transform: rotate(2deg) translateY(0); } 50% { transform: rotate(3deg) translateY(2px); } }
        @keyframes stretch { 0%,100% { transform: scaleY(1); } 35% { transform: scaleY(1.16) scaleX(0.93); } 55% { transform: scaleY(1.16) scaleX(0.93); } }
        @keyframes dangle { 0%,100% { transform: rotate(-6deg) scaleY(1.05) scaleX(0.96); } 50% { transform: rotate(6deg) scaleY(1.05) scaleX(0.96); } }

        /* Arms: rest at the sides; pivot at the shoulder. */
        svg { overflow: visible; }
        .arm-l { transform-origin: 18px 136px; }
        .arm-r { transform-origin: 152px 136px; }
        .arm { transition: transform 0.25s ease-out; }

        svg.pose-waving .arm-r { animation: wavearmR 0.55s ease-in-out infinite; }
        @keyframes wavearmR { 0%,100% { transform: rotate(140deg); } 50% { transform: rotate(178deg); } }

        svg.pose-celebrating .arm-l { animation: cheerL 0.65s ease-in-out infinite; }
        svg.pose-celebrating .arm-r { animation: cheerR 0.65s ease-in-out infinite; }
        @keyframes cheerL { 0%,100% { transform: rotate(-145deg); } 50% { transform: rotate(-165deg); } }
        @keyframes cheerR { 0%,100% { transform: rotate(145deg); } 50% { transform: rotate(165deg); } }

        /* Synced to the ball physics: one throw per 0.72s cycle per hand,
           left hand throws on even beats (cycle start), right on odd.
           Negative = inward for the left arm, positive = inward for the right. */
        svg.pose-juggling .arm-l { animation: juggleL 0.72s linear infinite; }
        svg.pose-juggling .arm-r { animation: juggleR 0.72s linear infinite; animation-delay: -0.36s; }
        @keyframes juggleL {
          0%   { transform: rotate(-80deg); }
          22%  { transform: rotate(-40deg); }
          58%  { transform: rotate(-40deg); }
          85%  { transform: rotate(-68deg); }
          100% { transform: rotate(-80deg); }
        }
        @keyframes juggleR {
          0%   { transform: rotate(80deg); }
          22%  { transform: rotate(40deg); }
          58%  { transform: rotate(40deg); }
          85%  { transform: rotate(68deg); }
          100% { transform: rotate(80deg); }
        }

        svg.pose-juggling { animation: jugglebob 0.35s ease-in-out infinite; }
        @keyframes jugglebob { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.975) scaleX(1.008); } }

        .specs { transform-origin: 85px 118px; animation: specson 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes specson {
          0% { transform: translateY(-26px) scale(0.7); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }

        /* Noting: hands hold the notepad; pen moves only while scribbling. */
        svg.pose-noting .arm-l { transform: rotate(-52deg); }
        svg.pose-noting .arm-r { transform: rotate(52deg); }
        svg.pose-noting .scribble, svg.pose-noting .pencil { animation-play-state: paused; }
        svg.pose-noting.scribbling .scribble, svg.pose-noting.scribbling .pencil { animation-play-state: running; }
        svg.pose-noting.scribbling { animation: writebob 1.2s ease-in-out infinite; }

        .sprout-pop { transform-origin: 85px 74px; animation: sproutpop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes sproutpop { 0% { transform: scale(0.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

        .zz { animation: zfloat 2.4s steps(7) infinite; opacity: 0; }
        .z2 { animation-delay: 0.5s; }
        .z3 { animation-delay: 1s; }
        @keyframes zfloat { 0% { opacity: 0; transform: translateY(4px); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-10px); } }

        .dot { animation: dotpulse 1.4s steps(5) infinite; opacity: 0.3; }
        .d2 { animation-delay: 0.25s; }
        .d3 { animation-delay: 0.5s; }
        @keyframes dotpulse { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }

        .spark { transform-box: fill-box; transform-origin: center; animation: sparkpop 0.9s ease-in-out infinite; }
        .s2 { animation-delay: 0.2s; }
        .s3 { animation-delay: 0.45s; }
        @keyframes sparkpop { 0%,100% { transform: scale(0.4); opacity: 0.2; } 50% { transform: scale(1.15); opacity: 1; } }

        .scribble { stroke-dasharray: 160; animation: scribbling 1.7s linear infinite; }
        @keyframes scribbling { 0% { stroke-dashoffset: 160; } 100% { stroke-dashoffset: 0; } }

        .pencil { transform-box: fill-box; transform-origin: center; animation: pencilmove 0.85s ease-in-out infinite; }
        @keyframes pencilmove { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-14px) translateY(3px); } }
      `}</style>
    </svg>
  );
}
