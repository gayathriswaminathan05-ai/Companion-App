# Blob Animation Clips — AI Video Shooting List

## Step 0: the master reference image (do this first, once)
CHARACTER: the little blooming TREE (see chat for the full reference prompt —
fuzzy-gradient or flat-chunky variant). Generate WITHOUT flowers: blossoms are
the growth layer, composited by code as accomplishments happen.

Pick your favorite → this exact image is the START FRAME for every clip below.

## Rules for EVERY clip (paste these lines into every video prompt)
- same character, identical design and colors throughout, flat 2D cartoon style
- camera completely static, no zoom, no pan
- character stays centered, full body always visible in frame
- solid bright magenta background stays unchanged
- motion loops: character ends in the same pose it started in
- duration: 3–5 seconds

## The clips (priority order — send them as you make them)
Name each file exactly as below, drop into: assets/clips/

1. **idle.mp4** — "the creature breathes gently and slowly, tiny squash and
   stretch, blinks twice, otherwise still"  ← DO THIS ONE FIRST; it's 95% of
   screen time. Generate several takes, keep the calmest.
2. **sleeping.mp4** — "the creature lies on its side sleeping peacefully, slow
   deep breathing, eyes closed" (generate a separate start frame of it lying
   down first if easier)
3. **yawn.mp4** — "the creature yawns hugely with eyes squeezed shut, stretches
   up, then settles" 
4. **waking.mp4** — "the creature springs up cheerfully from a sleepy squash,
   little bounce, opens eyes"
5. **celebrating.mp4** — "the creature jumps up and down joyfully, both arms
   raised, huge happy smile, eyes closed in joy"
6. **waving.mp4** — "the creature waves its right arm in greeting, body rocks
   gently side to side, friendly smile"
7. **stretching.mp4** — "the creature stretches arms up overhead then bends its
   body left and right like a little workout"
8. **writing.mp4** — "the creature wears small round glasses and looks down,
   holding a tiny notebook, scribbling with a pencil"
9. **listening.mp4** — "the creature leans slightly forward, attentive wide
   eyes, small encouraging nods"
10. **thinking.mp4** — "the creature looks up thoughtfully, swaying gently,
    pondering expression"
11. **watering.mp4** — "the creature holds a small blue cup above its own head,
    pouring water drops onto its own leafy canopy, content closed eyes"
12. **dragged.mp4** — "the creature dangles and swings gently side to side,
    surprised wide eyes, small round open mouth"

NOT needed: juggling (stays code-drawn so menu balls sync perfectly),
sprout stages (stays a code layer so it can change dynamically).
IMPORTANT: generate all clips WITHOUT flowers — blossoms are the code-drawn
growth layer (bare canopy → bud → blossoms → full bloom), overlaid dynamically.
Also generate one still image: "small cluster of soft pink blossoms, same
style, magenta background" for the bloom overlay sprites.

## Take-selection checklist (before sending me a clip)
- [ ] character looks identical to reference (colors, proportions, face)
- [ ] background stayed solid magenta (no drift to other colors)
- [ ] camera didn't move
- [ ] nothing extra appeared (no second character, no props except specified)
- [ ] first and last frames are close enough to loop

## What Claude does with each clip
frames extracted → magenta removed → cropped/centered → resized → sprite sheet →
wired into the app for that state. States without clips keep the placeholder.
