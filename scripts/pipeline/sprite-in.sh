#!/bin/bash
# sprite-in.sh <clip-name> <state>
# A NEW Higgsfield clip (assets/clips/<clip>.mp4) → app animation public/character/<state>:
#   1. Lumio cut-out (Gayathri's own background remover, ~/Desktop/Background remover)
#   2. sleeping* clips: soften edges where the blanket runs off the frame
#   3. process-clip.cjs → PNG frames + src/generated/sprites.ts entry
# Work files live in $WORK (default /tmp/companion-lumio). It is a CACHE:
# delete $WORK/<state> before re-cutting a clip you re-trimmed.
cd "$(dirname "$0")/../.."
PY="${LUMIO_PY:-/Users/supertail/Desktop/Background remover/.venv/bin/python}"
FF=$(node -p "require('ffmpeg-static')")
WORK="${WORK:-/tmp/companion-lumio}"; mkdir -p "$WORK"
"$PY" scripts/lumio_cutout.py "assets/clips/$1.mp4" "$WORK/$2" "$FF" < /dev/null 2>&1 | grep -E "CUTOUT_DONE|Error"
case $2 in sleeping*) "$PY" scripts/pipeline/feather_edges.py "$WORK/$2" < /dev/null ;; esac
CLIP_PREKEYED_DIR="$WORK/$2" node scripts/process-clip.cjs "assets/clips/$1.mp4" "$2" < /dev/null 2>&1 | grep -E "clean frames|rror"
