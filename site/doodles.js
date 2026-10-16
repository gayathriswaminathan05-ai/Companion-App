// Desk doodles for the landing page: one-line-colour illustrations with soft
// flat fills (owner's refs: duotone desk illustration, ink sketch, line-art
// grid). Classes, styled in styles.css (.dd):
//   k = line only · w = white fill · t = lavender fill · p = coral fill
//   s = butter fill · i = solid ink · thick = heavier line · ok = green tick
// Moving parts: a-steam, a-buzz, a-shake, a-twinkle, a-float, a-hand, a-drip,
// a-trail, a-ping, a-blink (all off for reduced motion).
// <span class="dd" data-doodle="coffee"> gets filled by main.js (loaded first,
// plain script so it works without a bundler).

const X = (x, y) => `M${x} ${y}l7 7M${x + 7} ${y}l-7 7`;
const DROP = (x, y, s = 1) =>
  `<path class="t" d="M${x} ${y}c${4 * s} ${6 * s} ${4 * s} ${9 * s} 0 ${10 * s}c${-4 * s} ${-1 * s} ${-4 * s} ${-4 * s} 0 ${-10 * s}z"/>`;
const STAR = (x, y, r = 5) =>
  `<path class="i" d="M${x} ${y - r}l${r * 0.35} ${r * 0.65} ${r * 0.65} ${r * 0.35}-${r * 0.65} ${r * 0.35}-${r * 0.35} ${r * 0.65}-${r * 0.35}-${r * 0.65}-${r * 0.65}-${r * 0.35} ${r * 0.65}-${r * 0.35}z"/>`;

const LAPTOP = (mood) => `<svg viewBox="0 0 140 110">
  <rect class="w" x="24" y="8" width="92" height="66" rx="7"/>
  <rect class="t" x="32" y="16" width="76" height="50" rx="3"/>
  <g class="a-blink"><circle class="i" cx="58" cy="36" r="3.2"/><circle class="i" cx="82" cy="36" r="3.2"/></g>
  ${mood === "happy" ? '<path class="k" d="M58 46c6 9 18 9 24 0"/>' : '<path class="k" d="M60 55c6-7 14-7 20 0"/>'}
  ${mood === "happy" ? '<circle class="p" cx="50" cy="48" r="3.5" stroke="none"/><circle class="p" cx="90" cy="48" r="3.5" stroke="none"/>' : ""}
  <path class="k" d="M24 74l-8 6M116 74l8 6"/>
  <path class="w" d="M16 80h108l-6 13a5 5 0 0 1-4.6 3H26.6a5 5 0 0 1-4.6-3z"/>
  <path class="k" d="M60 88h20"/>
</svg>`;

window.DOODLES = {
  coffee: `<svg viewBox="0 0 120 120">
    <g class="a-steam"><path class="k" d="M50 30c-5-5 5-9 0-14s5-9 0-14"/><path class="k" d="M62 28c-5-5 5-9 0-14s5-9 0-14"/><path class="k" d="M74 30c-5-5 5-9 0-14s5-9 0-14"/></g>
    <path class="w" d="M38 48h46l-6 58a5 5 0 0 1-5 4.5H49a5 5 0 0 1-5-4.5z"/>
    <path class="p" d="M40.3 64h41.4l-2.1 24H42.4z"/>
    <path class="k" d="M50 78c3-5 5-5 6 0s3 5 6 0 3-5 6 0"/>
    <path class="t" d="M33 40a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v8H33z"/>
    <path class="k" d="M41 36c1-5 4-7 9-7h22c5 0 8 2 9 7"/>
  </svg>`,

  "laptop-sad": LAPTOP("sad"),
  "laptop-happy": LAPTOP("happy"),

  calendar: `<svg viewBox="0 0 120 120">
    <rect class="w" x="14" y="26" width="92" height="80" rx="8"/>
    <path class="t" d="M14 34a8 8 0 0 1 8-8h76a8 8 0 0 1 8 8v12H14z"/>
    <path class="k" d="M24 37c3-4 6-4 9 0s6 4 9 0 6-4 9 0 6 4 9 0 6-4 9 0 6 4 9 0"/>
    <path class="k thick" d="M38 16v18M82 16v18"/>
    <path class="k" d="${X(24, 56)}${X(40, 56)}${X(56, 56)}${X(72, 56)}${X(88, 56)}${X(24, 72)}${X(40, 72)}"/>
    <circle class="k ring" cx="76" cy="90" r="10"/>
  </svg>`,

  phone: `<svg viewBox="0 0 120 120">
    <g class="a-buzz"><path class="k" d="M30 42l-7 5 7 5-7 5 7 5"/><path class="k" d="M90 42l7 5-7 5 7 5-7 5"/></g>
    <g class="a-shake">
      <rect class="w" x="42" y="22" width="36" height="76" rx="8"/>
      <rect class="t" x="48" y="32" width="24" height="52" rx="3"/>
      <path class="k" d="M54 52l10-10M54 62l14-14"/>
      <path class="k" d="M56 91h8"/>
    </g>
  </svg>`,

  pencil: `<svg viewBox="0 0 120 120">
    <g transform="rotate(-38 60 60)">
      <rect class="s" x="30" y="53" width="62" height="14" rx="2"/>
      <rect class="p" x="92" y="53" width="12" height="14" rx="3"/>
      <path class="w" d="M30 53L12 60l18 7z"/>
      <path class="i" d="M17.5 57.9L12 60l5.5 2.1z"/>
    </g>
    <g class="a-twinkle"><circle class="i" cx="16" cy="98" r="2.2"/><circle class="i" cx="30" cy="110" r="2"/><circle class="i" cx="8" cy="82" r="1.6"/><circle class="i" cx="36" cy="96" r="1.6"/></g>
  </svg>`,

  sticky: `<svg viewBox="0 0 120 120">
    <g transform="rotate(-5 60 60)">
      <path class="s" d="M22 22h76v62L84 98H22z"/>
      <path class="k" d="M98 84H86a2 2 0 0 0-2 2v12"/>
      <rect class="t" x="44" y="14" width="32" height="12" rx="2" opacity=".85"/>
      <rect class="w" x="32" y="38" width="10" height="10" rx="2"/><path class="k ok" d="M34 43l3 3 6-7"/><path class="k" d="M50 43h34"/>
      <rect class="w" x="32" y="56" width="10" height="10" rx="2"/><path class="k ok" d="M34 61l3 3 6-7"/><path class="k" d="M50 61h28"/>
      <rect class="w" x="32" y="74" width="10" height="10" rx="2"/><path class="k" d="M50 79h20"/>
    </g>
  </svg>`,

  lamp: `<svg viewBox="0 0 120 120">
    <g class="a-ping"><path class="k" d="M84 64l4 9M95 59l9 6M74 66l-1 10"/></g>
    <rect class="t" x="26" y="100" width="50" height="9" rx="4.5"/>
    <path class="k" d="M51 100L38 66l30-26"/>
    <circle class="w" cx="38" cy="66" r="4"/>
    <path class="p" d="M60 32l24-16 20 28-28 12z"/>
    <circle class="w" cx="68" cy="40" r="4"/>
  </svg>`,

  headphones: `<svg viewBox="0 0 120 120">
    <path class="k thick" d="M26 74V62a34 34 0 0 1 68 0v12"/>
    <rect class="t" x="16" y="66" width="18" height="32" rx="8"/>
    <rect class="t" x="86" y="66" width="18" height="32" rx="8"/>
    <g class="a-float"><circle class="i" cx="96" cy="30" r="5"/><path class="k" d="M100.5 30V12c4 1 8 3 8 8"/></g>
    <g class="a-float late"><circle class="i" cx="24" cy="30" r="4"/><path class="k" d="M27.5 30V16c3 1 6 2 6 6"/></g>
  </svg>`,

  papers: `<svg viewBox="0 0 120 120">
    <path class="k" d="M14 90l34 16 58-14M14 84l34 16 58-14"/>
    <path class="w" d="M14 78l56-14 36 14-58 16z"/>
    <path class="k" d="M36 76l26-6M42 82l24-6M50 87l16-4"/>
    <g class="a-float"><path class="k" d="M30 52c2-6 6-6 8 0M44 44c2-6 6-6 8 0"/><path class="k" d="M60 40c3-8 9-8 12 0"/></g>
  </svg>`,

  envelope: `<svg viewBox="0 0 120 120">
    <g class="a-ping"><path class="k" d="M60 30V20M45 33l-6-8M75 33l6-8"/></g>
    <rect class="w" x="22" y="42" width="76" height="52" rx="6"/>
    <path class="k" d="M24 46l36 26 36-26"/>
    <circle class="p" cx="96" cy="44" r="8"/>
  </svg>`,

  water: `<svg viewBox="0 0 120 120">
    <path class="k thick straw" d="M68 34l8-22"/>
    <path class="w" d="M36 32h48l-6 72a5 5 0 0 1-5 4.5H47a5 5 0 0 1-5-4.5z"/>
    <path class="t" d="M38.6 62c7-5 14-5 21 0s14 5 21.8 0l-3.4 42a5 5 0 0 1-5 4.5H47a5 5 0 0 1-5-4.5z"/>
    <g class="a-drip">${DROP(98, 36)}${DROP(20, 58, 0.8)}</g>
  </svg>`,

  clock: `<svg viewBox="0 0 120 120">
    <g class="a-ping"><path class="k" d="M16 52l-8-2M16 64l-9 2M104 52l8-2M104 64l9 2"/></g>
    <path class="p" d="M24 40a13 13 0 0 1 20-16z"/>
    <path class="p" d="M96 40a13 13 0 0 0-20-16z"/>
    <path class="k" d="M40 98l-8 10M80 98l8 10"/>
    <circle class="w" cx="60" cy="64" r="34"/>
    <path class="k a-hand" d="M60 64V42"/>
    <path class="k" d="M60 64h14"/>
    <circle class="i" cx="60" cy="64" r="3"/>
  </svg>`,

  popper: `<svg viewBox="0 0 120 120">
    <path class="p" d="M18 106l22-54 32 32z"/>
    <path class="k" d="M29 79l13 13M23 93l7 7"/>
    <g class="a-twinkle">
      <path class="k" d="M56 44l6-12M74 58l12-4"/>
      <path class="k" d="M64 28c4-6 10-6 12 0s8 6 12 0"/>
      <circle class="t" cx="96" cy="72" r="5"/>
      <circle class="s" cx="86" cy="20" r="5"/>
      <rect class="p" x="98" y="38" width="9" height="9" rx="2" transform="rotate(20 102 42)"/>
      ${STAR(46, 20, 6)}
    </g>
  </svg>`,

  can: `<svg viewBox="0 0 140 120">
    <path class="k thick" d="M48 52c4-24 32-24 36 0"/>
    <path class="k thick" d="M92 70l26-22"/>
    <path class="t" d="M36 52h56v40a8 8 0 0 1-8 8H44a8 8 0 0 1-8-8z"/>
    <path class="w" d="M112 40l14 12-6 5-12-10z"/>
    <g class="a-drip">${DROP(126, 64, 0.7)}${DROP(116, 76, 0.7)}${DROP(131, 84, 0.7)}</g>
  </svg>`,

  moon: `<svg viewBox="0 0 120 120">
    <path class="s" d="M72 22a36 36 0 1 0 30 54 30 30 0 1 1-30-54z"/>
    <g class="a-float"><path class="k" d="M20 34h12L20 46h12"/><path class="k" d="M38 18h8l-8 8h8"/></g>
    <g class="a-twinkle">${STAR(102, 22, 6)}<circle class="i" cx="104" cy="46" r="2"/></g>
  </svg>`,

  plane: `<svg viewBox="0 0 140 100">
    <path class="k a-trail" d="M8 92c20-40 46-46 64-30"/>
    <path class="w" d="M64 44l70-30-30 70-12-24z"/>
    <path class="k" d="M134 14L92 60"/>
    <path class="t" d="M92 60l-4 20 16-12z"/>
  </svg>`,

  glasses: `<svg viewBox="0 0 120 70">
    <circle class="t" cx="38" cy="38" r="17"/>
    <circle class="t" cx="82" cy="38" r="17"/>
    <path class="k" d="M55 34c4-5 6-5 10 0M21 32L8 24M99 32l13-8"/>
    <path class="k shine" d="M30 36l7-7M74 36l7-7"/>
  </svg>`,

  sparkle: `<svg viewBox="0 0 40 40"><g class="a-twinkle"><path class="s" d="M20 3l4.5 12.5L37 20l-12.5 4.5L20 37l-4.5-12.5L3 20l12.5-4.5z"/></g></svg>`,
};
