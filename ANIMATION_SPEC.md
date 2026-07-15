# Blob Animation Spec — for Rive

Build ONE artboard ("Blob") with one rig. All animations below live on that rig.
Design canvas: 340×400 units (displayed ~170×200px; keep 2x detail).
Anchor: bottom-center = where Blob "stands". Overflow above/sides is fine.

## Layer structure (name layers exactly like this for sanity)
- body (squash/stretch root — everything except zzz/dots/sparkles parents here)
  - belly
  - feet-l, feet-r
  - arm-l, arm-r (each: upper + hand with 3 fingers; shoulder pivot)
  - face: eye-l, eye-r (+ lids for blinks), blush-l, blush-r, mouth
  - specs (glasses — hidden by default)
  - notebook + pencil (hidden by default)
  - cup (water cup — hidden by default)
  - sprout (nested artboard or group with 4 states: bud / leaf / leaves / bloom)
- fx: zzz text, thinking dots, celebration sparkles, water drops + splash

## State machine: "main"
Inputs I will drive from code:
- state (enum/number): 0 idle, 1 sleeping, 2 waking, 3 waving, 4 celebrating,
  5 writing, 6 stretching, 7 listening, 8 thinking, 9 juggling, 10 noting,
  11 watering, 12 dragged
- sproutStage (number 0-3): bud → leaf → leaves → bloom (pop-in transition on change)
- scribbling (bool): only relevant in noting — pen moves when true, pauses when false
- blink handled inside Rive (random 2.5–6s) — no input needed

## Animations (loop = repeats until state changes)
| name | loop | duration | description |
|---|---|---|---|
| idle | ✅ | ~3.2s | gentle breath (scaleY ±1.5%), occasional micro-wiggle; blinks |
| sleeping-enter | ▶ once | ~1.7s | big yawn (eyes squeezed, mouth wide, tongue) → tips over sideways |
| sleeping | ✅ | ~4.6s | lying on side, head left, feet right; slow breathing; zzz float from mouth |
| waking | ▶ once | ~1.4s | springs up from lying with overshoot bounce → idle |
| waving | ✅ | ~1.1s | body rocks, right arm raised waving |
| celebrating | ✅ | ~0.65s | happy hops, both arms up cheering, ^ ^ eyes, sparkles |
| writing | ✅ | ~1.2s | specs ON (drop-in with bounce), notebook out, eyes down, pen scribbles |
| stretching | ▶ once | ~2.8s | reach up tall → waist bends L/R/L → return; arms pump overhead |
| listening | hold | 0.6s in | leans toward viewer slightly, attentive eyes |
| thinking | ✅ | ~3s | gentle sway, eyes up-left, "..." dots pulse above |
| juggling | ✅ | 0.72s/cycle | arms alternate catch-toss rhythm (balls are drawn BY THE APP,
|  |  |  | not in Rive — hands must hit "catch point" at cycle 0% and 50%, position
|  |  |  | ~(±28, -52) from bottom-center anchor, so code-driven balls land in palms) |
| noting | ✅ | ~3.2s | holds notepad with both hands, specs on, breathing; pen has
|  |  |  | separate "scribble" sub-anim gated by `scribbling` input |
| watering | ✅ | ~2.4s | right arm holds cup tipping over head; drops fall on sprout;
|  |  |  | tiny splash; content closed eyes |
| dragged | ✅ | ~0.5s | dangles/swings, wide surprised eyes, small o mouth |
| sprout-grow | ▶ once | ~0.5s | (on sproutStage change) new stage pops in with springy scale |

## Transition rules
- Everything blends back to idle (0.15–0.25s cross-blend), EXCEPT
  sleeping-enter → sleeping (auto-chain) and waking (only exits sleeping).
- No animation may dead-end frozen.

## Style
- Flat chunky shapes, thick soft forms, no outlines (or minimal).
- Palette: body #FFCF96, belly #FFF3DF, cheeks #F7A98F, face #4A3226,
  sprout greens #6FA050/#7FB25B/#93C46F, bloom #F9A8C4 + #FFE08A.
  (Free to evolve in the Figma pass — keep contrast at 150px in mind.)
- Must read clearly at 150px height on a busy desktop.

## Handoff
Export .riv → drop in assets/. Claude wires @rive-app runtime into
src/character/ replacing the procedural Blob, mapping useCharacter states to
the state machine inputs. Menu balls stay code-drawn (they're dynamic UI).
