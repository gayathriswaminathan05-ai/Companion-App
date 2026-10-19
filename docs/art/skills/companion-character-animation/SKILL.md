---
name: companion-character-animation
description: Create growth-stage variants and prepare paid character animations for Gayathri's Companion app, using approved art, existing motion references, Higgsfield and her Lumio cutout tool. Use for this project's mascot clips, not unrelated animation or UI motion.
---

# Companion character animation

Read the project's AGENTS.md and current CLAUDE.md decisions. Work in the owner's
Companion app repository; do not infer approval from historical generation jobs.

## Establish appearance AND motion before spending

- Find the existing pose still, raw clip in assets/clips, and in-app frames in
  public/character. Inspect the original motion across its full duration, including
  start, middle, end and loop seam. A still alone is not a motion reference. Use
  playback where available and temporal frame sheets to examine limbs and foliage.
- Separate identity constraints (growth stage, leaf/flower arrangement, pot,
  face, hand anatomy) from movement (floating, arm drift, leaf sway, breathing).
  'Keep the hands exactly' means preserve their design, NOT immobilize the arms.
- Record a concrete motion brief: body path/amplitude, arm movement, foliage
  movement, expression, pacing, framing and loop. Compare it with the existing
  reference and the owner's words. Never add prohibitions that contradict them.
- For growth variants, use both the approved pose reference for body/hands and
  the exact stage reference for foliage. Do not borrow mature foliage at stage1.
  Prefer built-in image generation for new stills when available. Keep white source
  backgrounds and preserve every earlier version. Review the still before video.

## Current meditation reference

The approved existing movement is assets/clips/meditate.mp4, with in-app frames
at public/character/meditate. The body gently floats up and down, arms/hands drift
gently and leaves sway. Eyes stay closed, legs crossed, hand gestures intact.
Preserve this liveliness; do not prompt 'hands remain still', 'no floating',
'grounded at the same location', or reduce it to barely visible pot breathing.

Stage1 approved appearance:
mascot-poses/stage-poses/meditation-hula-v1/meditate-stage1-v2-builtin.png.
Do not use meditate1-v1.mp4 (rejected hands) or meditate1-v2.mp4 (over-restricted
motion) as the desired motion reference. They are preserved history only.

A suitable motion brief describes a slow, small vertical floating cycle of the
whole seated character, gently drifting forearms with unchanged open-palmed
gestures, softly swaying existing leaves, closed eyes and a relaxed smile. Camera
stays fixed; subject has enough margin at the top and bottom of the float. Motion
returns smoothly to its start. Match the reference's observed pace/amplitude;
do not invent dramatic motion or hardcode an unmeasured displacement.

## Paid submission gate

- Prepare the actual complete prompt, model/settings, reference roles and outputs
  first. Check current model capabilities and quote the exact request. For explicit
  motion transfer, follow the connected tool's motion-transfer routing; do not
  claim a video was used as reference if only a text description was submitted.
  A different model/price needs approval if outside the approved allocation.
- Before submission, check the positive motion instructions and every negative
  instruction against the motion brief. Inspect the actual uploaded still. Use
  approved stills as start/end only when supported and suitable for the motion.
- Present a short plain-language description of the intended movement together
  with the exact credit cost when requesting an approval not already granted.
  Still approval alone does not approve a video or a retry. Reuse valid approvals;
  do not ask again if the exact shot and budget are already authorized.
- Submit once within the approved budget. Save the prompt, settings, reference
  IDs and job ID immediately. Never resubmit after a timeout until the first
  outcome is known. No paid retakes or batch expansion without new authorization.
- Good preparation reduces risk; never promise the generator will be perfect in
  one attempt. If the result fails, say which requirement failed and preserve it.

## Cutout and verification

- Generate on solid white, then use the owner's local Lumio via
  scripts/lumio_cutout.py and ~/Desktop/Background remover. Do not substitute
  another background remover. Keep raw clips and transparent outputs separately.
- Inspect hands, foliage, body proportions, motion, loop seam, margins and edge
  flicker. Composite cutouts over light and dark backgrounds to check fingers,
  leaf gaps and halos. Check alpha actually exists; transparent RGB can look
  strange in viewers that ignore alpha.
- Compare appearance to the approved still AND movement to the existing clip.
  Do not call a clip complete merely because generation and cutout succeeded.
- Fix trimming/loop timing locally when possible, preserving the source. Do not
  silently substitute a whole-image bob for articulated arm/leaf animation or
  spend more credits to repair an error. Explain what a free edit can achieve.
- For the approved stage1 meditation art, a free local correction is available in
  scripts/pipeline/meditation-local-motion.py. It tracks the original clip's body,
  hands and foliage, applies periodic floating and separate rigid hand/leaf motion
  to a Lumio cutout, and writes a new frame directory. It is a 2D approximation;
  attachment coordinates are specific to this still, not other stages/poses.
  Inspect joins, leaf base, alpha, margins and loop before proposing reuse.
- Show the result for review before installing a new sample in the app. Keep
  stage4 originals and prior options. Update CLAUDE.md with approvals, spend,
  outputs, verification, limitations and next actions.
