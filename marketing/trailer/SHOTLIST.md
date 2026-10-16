# Trailer — "You're not alone at your desk" (draft v1, Oct 15 2026)

## v2 direction (owner, Oct 15) — supersedes the [P]/[S] split below
- LOOK: bright, colourful, Gen-Z dorky indie developer (refs: cobalt desk,
  yellow chair, cork board + pastel sticky notes, green cutting mat, candy
  keycaps, rubber duck, toys, mushroom lamp, succulent in pink pot, sunny
  window; one pink gamer-room ref shot from behind).
- FRAMING: his full face is NOT needed. Mostly behind / over-the-shoulder /
  side-profile shots where emotion is body language AND the use case is on
  his screen in the same frame. A few side-profile close-ups for laughs/smiles.
- SCREEN TRICK: locked-off camera; in the start still his laptop/monitor
  screen is plain chroma green; AI animates only him; in the edit the green
  is keyed and the REAL app recording goes behind it (head/hands occlude it
  naturally). AI never renders UI.
- Consistency anchors: curly hair, round glasses, headphones, PLAIN grey
  tee (owner: no loud shirt in a bright room), the one room.
  CAST: actor2-A + room2-2 (marketing/trailer/casting). Round 1 rejected.
- DESK (owner): 27" monitor on an arm + laptop on a stand, busy real project
  on screen (many windows). Screens = marketing/trailer/screens/*.html →
  PNG via `npx electron marketing/trailer/screens/capture.cjs <file>.html`
  (one file per run). Unbranded editor/browser/terminal/team chat + plant.
- LIGHT (owner): day → dim warm evening like her lamp-lit reference.
  Approved look frames: frames/busy-day-a.png (day), frames/busy-dim-a.png
  (evening); composites frames/_busy-*-screens.png. Focus shift to the
  plant's screen = done in the edit (digital push-in + soft blur on him),
  since the source camera stays locked for clean screen compositing.
- Storyboard v2 (9 shots) lives on the wireframe canvas, row "Trailer".
- PIPELINE (shot 5 = approved test, shots/05-stretch-v2.mp4):
  1. Kling 3.0 pro 5 s from the look frame, locked camera, screens green.
  2. compose_shot.py: "virtual camera" — screens re-drawn per frame from
     screens/*@4x.png (CAPTURE_ZOOM=2 capture) + hi-res Lumio plant
     (plant-hi/, LUMIO_HEIGHT=960) + bubble@4x.png; exact screen outline +
     green fill before blur (no green fringe); push-in ends framed on the
     plant + bubble; --hold extends the close-up past the AI clip.
  3. audio/say.cjs = plant voice (Kokoro af_heart, same as the app);
     audio/mix_shot.py = room tone, clicks, rustle, app chirps (same synth
     as src/sounds.ts), voice through a small room reverb; ffmpeg mux.
  Owner feedback applied: push all the way in on the plant; laptop never
  blurry; screens never look green; must have audio.

Tone: cozy + funny. 60 s, 16:9 master for the landing page; each Act 3 scene
also cut as a 10–15 s vertical short for social.
Actor: AI-generated, photoreal, young tired Indian worker (gender TBD at casting).
Same person, same room in every shot; only the window light changes
(morning → afternoon → golden hour → night) so the day passes without words.

Legend: **[P]** person shot (AI video, Kling 3.0 pro, 8.75 cr / 5 s)
**[S]** screen shot (real app, screen-recorded / composited — 0 credits).
Rule: AI never draws the laptop screen. Person shots keep the screen angled
away or out of focus; the app only ever appears in [S] shots.

## Act 1 — Alone with the screen (0–12 s)
| # | Type | Time of day | Shot |
|---|---|---|---|
| 1 | P | 9:00 am | Wide: sits down with a cup of chai, opens the laptop, soft morning window light |
| 2 | P | 11:30 am | Close: hunched, rubbing the neck; full water bottle untouched beside the laptop |
| 3 | S | — | Generic inbox flooding with unread mail (our own mock, no real brand) |
| 4 | P | 2:00 pm | Tired eyes, big sigh, forehead slowly lands on the desk (comic beat) |

Text on screen: "Long days. Just you and the screen."

## Act 2 — Hello (12–18 s)
| 5 | S | — | The plant pops onto the desktop and waves |
| 6 | P | 2:00 pm | Lifts head, confused blink, then the first smile; leans toward the screen |

## Act 3 — The day, with a friend (18–46 s)
| 7 | S | — | Plant's visor stretch + bubble "Stretch with me?" |
| 8 | P | 3:00 pm | Stretches arms overhead in the chair, mirroring the plant, laughing (HERO SHOT) |
| 9 | S | — | Plant waters itself + "Water break!" |
| 10 | P | 3:30 pm | Grabs the water bottle, big sip, raises it to the screen like a toast |
| 11 | S | — | Bubble: "New email from Priya: 'Deck looks great!'" |
| 12 | P | 4:00 pm | Quick glance, relieved little smile and nod; no tab-hunting |
| 13 | S | — | Chat: types "rough day" → plant sips coffee, kind + funny reply |
| 14 | P | 4:30 pm | Laughs out loud, shakes head |
| 15 | S | — | Plant rings its bell: "Call mom at 6" |
| 16 | P | 6:00 pm golden hour | Picks up the phone, grinning: "Hi Ma!" |

## Act 4 — The win (46–52 s)
| 17 | S | — | Task "Submit report" ticked → plant hits full bloom, champagne pop, clay confetti |
| 18 | P | 6:30 pm | Tiny victory dance / fist pump in the chair |

## Act 5 — Goodnight (52–60 s)
| 19 | S | — | Plant yawns and pulls up its blanket at bedtime |
| 20 | P | 11:00 pm lamp light | Closes the laptop smiling, stretches, switches off the lamp |
| 21 | — | — | End card: [APP NAME] wordmark, bloom plant waving, "A little friend for long days." + Download for Mac |

## Production steps (each needs owner OK before spending)
1. Casting: ~4 actor options (Soul 2, ~0.12 cr each) → she picks one.
2. Room: one set still + 4 light variants of the same room.
3. Storyboard stills for the 11 [P] shots, same actor + room → she approves.
4. Videos: 11 × Kling 3.0 pro 5 s = ~96 cr (+ buffer for 2–3 retakes ≈ 120–125 cr).
   Balance before: 173.4 cr. Seedance 2.5 (35–80 cr/shot) ruled out on cost.
5. [S] shots: screen-record the real app on a clean desktop.
6. Edit: cuts, light film grain, ambient room sound + royalty-free track,
   captions, end card. Label as AI-generated on social platforms.
