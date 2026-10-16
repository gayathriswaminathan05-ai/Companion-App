#!/bin/bash
# Rebuild the narrated trailer from its parts (the exact settings used Oct 15-16).
#   marketing/trailer/rebuild.sh [plants] [shots] [beds] [voice] [trailer]
# No arguments = shots + beds + voice + trailer (plants are slow; only redo
# them when the plant animation art changes).
#   plants  : Lumio cut-outs of the plant at 960px for the close-ups (plant-hi/)
#   shots   : compose each scene: virtual camera + the plant + the app bubble
#   beds    : background sound per scene (room tone, typing, app chirps; no voice)
#   voice   : the plant's narration lines (voice D) → audio/narr-N.wav
#   trailer : join scenes + beds + narration → site/assets/video/trailer.mp4
# NOTE: scene 06b-email is still in the list; email is hidden in the app
# (Oct 16), so take it out of SCENES in scripts/site/build-trailer.py and
# narr line 5 when the trailer is next rebuilt.
set -e
cd "$(dirname "$0")/../.."
PY="${LUMIO_PY:-/Users/supertail/Desktop/Background remover/.venv/bin/python}"
FF=$(node -p "require('ffmpeg-static')")
T=marketing/trailer; S=$T/screens
steps="$*"; [ -z "$steps" ] && steps="shots beds voice trailer"
has() { [[ " $steps " == *" $1 "* ]]; }
mux() { "$FF" -loglevel error -y -i $T/shots/$1-silent.mp4 -i $T/audio/$2.wav -c:v copy -c:a aac -b:a 192k -shortest $T/shots/$1.mp4 && echo "DONE $1"; }

if has plants; then
  for c in waving watering4 growth4 meeting5 celebrating7 sleeping; do
    LUMIO_HEIGHT=960 "$PY" scripts/lumio_cutout.py assets/clips/$c.mp4 $T/plant-hi/$c "$FF" < /dev/null 2>&1 | grep -E "CUTOUT_DONE|Error"
  done
  LUMIO_HEIGHT=960 "$PY" scripts/lumio_cutout.py assets/clips/sleeping7b.mp4 $T/plant-hi/sleeping7 "$FF" < /dev/null 2>&1 | grep -E "CUTOUT_DONE|Error"
  "$PY" scripts/pipeline/feather_edges.py $T/plant-hi/sleeping7 < /dev/null
fi

if has shots; then
  # Scene audio with the OLD per-scene voice lines (shotNN.wav) is what the
  # individual shot .mp4s carry; the landing chapters use these.
  "$PY" $T/compose_shot.py $T/shots/01-struggle-raw.mp4 $T/shots/01-struggle-silent.mp4 --plant none --bubble none --push -1 0 --hold 0 | tail -1; mux 01-struggle shot01
  "$PY" $T/compose_shot.py $T/shots/04-hello-raw.mp4 $T/shots/04-hello-silent.mp4 --plant $T/plant-hi/waving --plant-start 1.0 --bubble $S/bubble-hello@4x.png --bubble-at 1.4 --push 2.4 4.4 --hold 1.6 | tail -1; mux 04-hello shot04
  "$PY" $T/compose_shot.py $T/shots/05-stretch-raw.mp4 $T/shots/05-stretch-v2-silent.mp4 --plant $T/plant-hi/stretching4 --plant-start 0.8 --bubble-at 0.3 --push 2.2 4.6 --hold 1.6 | tail -1; mux 05-stretch-v2 shot05
  "$PY" $T/compose_shot.py $T/shots/06a-water-raw.mp4 $T/shots/06a-water-silent.mp4 --plant $T/plant-hi/watering4 --plant-start 0.5 --plant-loop --bubble $S/bubble-water@4x.png --bubble-at 0.3 --push 2.6 4.6 --hold 1.4 | tail -1; mux 06a-water shot06a
  "$PY" $T/compose_shot.py $T/shots/06b-email-raw.mp4 $T/shots/06b-email-silent.mp4 --plant $T/plant-hi/growth4 --plant-start 0 --plant-loop --bubble $S/bubble-email@4x.png --bubble-at 1.0 --push 2.4 4.4 --hold 1.4 | tail -1; mux 06b-email shot06b
  "$PY" $T/compose_shot.py $T/shots/07-callmom-raw.mp4 $T/shots/07-callmom-silent.mp4 --plant $T/plant-hi/meeting5 --plant-start 0.1 --bubble $S/bubble-callmom@4x.png --bubble-at 0.3 --reverse --push 0.2 2.6 --preroll 0.8 --hold 0 | tail -1; mux 07-callmom shot07
  "$PY" $T/compose_shot.py $T/shots/08-win-raw.mp4 $T/shots/08-win-silent.mp4 --plant $T/plant-hi/celebrating7 --plant-start 1.0 --plant-fps 16 --bubble $S/bubble-win@4x.png --bubble-at 1.1 --push 1.6 3.6 --hold 1.8 | tail -1; mux 08-win shot08
  # 09 uses the STAGE-7 sleeping plant (08 ends in full bloom); stage-4 version kept as 09-goodnight-stage4.mp4
  "$PY" $T/compose_shot.py $T/shots/09-goodnight-raw.mp4 $T/shots/09-goodnight-silent.mp4 --plant $T/plant-hi/sleeping7 --plant-start 0.2 --bubble $S/bubble-goodnight@4x.png --bubble-at 0.4 --reverse --push 0.3 2.9 --preroll 1.0 --hold 0 | tail -1; mux 09-goodnight shot09
fi

if has beds; then
  cd $T/audio
  "$PY" mix_shot.py bed-01.wav --dur 5.04 --room -42 --typing 0.0 1.1 --msg 0.5 1.3 2.0 2.7 3.3 --rustle 1.2 3.4
  "$PY" mix_shot.py bed-04.wav --dur 6.64 --room -42 --rustle 0.6 --pop 1.4 --giggle 5.6
  "$PY" mix_shot.py bed-05.wav --dur 6.64 --room -42 --pop 0.3 --clicks 0.12 0.5 --rustle 1.0 --giggle 5.2
  "$PY" mix_shot.py bed-06a.wav --dur 6.44 --room -42 --pop 0.3 --rustle 1.1 --chime 4.0 --giggle 5.6
  "$PY" mix_shot.py bed-06b.wav --dur 6.44 --room -42 --typing 0.0 0.9 --pop 1.0 --rustle 2.2
  "$PY" mix_shot.py bed-07.wav --dur 5.84 --room -42 --bell 0.15 --rustle 2.6
  "$PY" mix_shot.py bed-08.wav --dur 6.84 --room -44 --clicks 0.9 --pop 1.1 --chime 2.6 --rustle 2.8 --giggle 6.0
  "$PY" mix_shot.py bed-09.wav --dur 6.04 --room -45 --sleepy 0.3 --rustle 3.6 --clicks 5.4
  cd - > /dev/null
fi

has voice && bash $T/audio/narrate.sh
has trailer && "$PY" scripts/site/build-trailer.py "$FF"
echo "rebuild done: $steps"
