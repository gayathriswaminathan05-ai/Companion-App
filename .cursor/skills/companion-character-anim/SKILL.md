---
name: companion-character-anim
description: >-
  Companion App character animation pipeline for Gayathri's desktop Electron
  mascot (terracotta pot succulent). Use whenever generating, prompting,
  keying, trimming, or wiring Kling/Higgsfield clips for idle, drag, growth
  level-ups, celebrations, or any new pose — or when the user mentions growth
  stages, plant lock, confetti, credits, process-clip, or magenta keying.
---

# Companion character animation

Owner is non-technical. Prefer **one correct paid take** over cheap retries.
Always `get_cost:true` first. Ask before jobs that cost more than ~7.5 credits
unless she already approved the shot.

## Hard consistency rule (non-negotiable)

Growth stage identity must match **idle** for that stage across ALL animations
(drag, level-up, celebrate, watering, rest poses).

- Idle stage N = `mascot-poses/growth-stages/stage-N.png` and
  `public/character/growthN/`
- Known Higgsfield media IDs (stage stills):
  - 1 `b653288d-6617-4d05-9fdb-ebdd45db8f95`
  - 2 `a3c39bbf-37c8-4467-b84b-f9d90f80f8d5`
  - 3 `b5467757-4b91-4954-b571-7cf448eb5bf2`
  - 4 `919f9040-9011-4ac5-acb3-e6935431d196`
  - 5 `eadf473f-9ba1-487c-b11b-aaf8e5a082c3`
  - 6 `c83a8fca-13d4-41ff-9212-d7517b826651`
- Level-up `growNtoM`: **start_image = stage N**, **end_image = stage M**
- Never invent a new plant look in the prompt alone — stills lock identity

## Background / keying

Prefer **solid hot magenta `#FF00FF`** plates for this character.

| Plate | Key settings | Notes |
|-------|----------------|-------|
| Magenta | `CLIP_T=15 CLIP_GLOBAL=off CLIP_ERODE=2` | Proven for idle/growth |
| White | Avoid for new takes | Eats pot highlights + eye speculars |

After keying: hard-kill true chroma magenta leftovers; protect green leaves,
terracotta, blush, yellow flower centers.

**Do not put confetti in Kling videos** for growth level-ups. Crop/bbox + debris
cleanup clips particles into a “box”. Add **app confetti** in `Blob.tsx`
(`ConfettiBurst` over `public/fx/confetti/`, `overflow: visible`) on every
`growNtoM` + `celebrating` — free, clean, no credits.

## Level-up story beats (growNtoM)

One 5s Kling clip, oneshot + `holdLast`. **Vary the joy beat per stage** so
level-ups don't feel identical. Confetti is always **CSS in the app**, never
baked into Kling.

1. **Start** — exact stage-N plant (matches idle N)
2. **Joy (~2–2.5s)** — pot hops + laughs; then the stage's signature gesture
3. **Grow (~2s)** — leaves morph to exact stage-M plant
4. **End** — calm smile, arms down, matches idle M still

### Celebration ladder (planned)

| Transition | Joy gesture (in video) | Confetti (app) |
|------------|------------------------|----------------|
| 1→2 | hop + laugh + **clap** | CSS burst |
| 2→3 | hop + laugh + **theatrical bow** | CSS burst |
| 3→4 | hop + laugh + **spin / twirl** | CSS burst |
| 4→5 | hop + laugh + **superhero landing** (ref: assets/refs/superhero-landing.png) | CSS burst |
| 5→6 | laugh + **real champagne bottle** cork-pull + spray from bottle → bloom | app confetti GIF |

Prompt must say: slow/crisp, no human hands, no camera move, no pink/magenta
props, plant lock start→end, **NO confetti/particles in video**.

## Credit discipline

1. `get_cost:true` before every paid job
2. Exhaust free fixes first: trim, re-key, CSS overlay, `CLIP_*` env
3. One take when possible; no parallel “just in case” videos
4. Stills before video for new props
5. If start≠end, check for **reseal** at the end — trim before process-clip

## Process pipeline

```bash
# Magenta character clip → sprites
unset ELECTRON_RUN_AS_NODE
export CLIP_T=15 CLIP_GLOBAL=off CLIP_ERODE=2
node scripts/process-clip.cjs assets/clips/<name>.mp4 <stateName>
```

- Growth transitions `grow1to2`…`grow5to6` are oneshot + holdLast at **20fps**
  (see `scripts/process-clip.cjs`); TIMED ~3.3s in `useCharacter.ts`
- Test with always-on **GrowthTestBar** (right of plant): idle 1–6, play N→M
- Launch: `unset ELECTRON_RUN_AS_NODE; npx vite build && ./node_modules/.bin/electron .`

## Preflight checklist (before spending)

- [ ] Start/end stills are the correct stage files / media IDs
- [ ] Prompt locks plant identity and lists joy beats (hop/laugh/clap)
- [ ] Confetti planned as **CSS**, not in the video
- [ ] Magenta plate (not white) unless she explicitly wants otherwise
- [ ] Cost preflight done; one job submitted
- [ ] After download: QA start vs idle N, end vs idle M, before keying
- [ ] After key: no magenta fringe, no eye holes, confetti overlay not clipped

## Reference assets

- Stage stills: `mascot-poses/growth-stages/`
- Confetti style ref: `assets/refs/confetti-style.png` (CSS colors, not Kling)
- Prompt log: `mascot-poses/growth-stages/PROMPT.txt`
