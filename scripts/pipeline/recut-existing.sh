#!/bin/bash
# recut-existing.sh clip:state [clip:state ...]
# Re-cut an EXISTING animation with Lumio and place the new frames exactly on
# the old frames' framing (so sizes in the app don't move). Example:
#   scripts/pipeline/recut-existing.sh meeting7-full:meeting7
# Check drift afterwards: python scripts/lumio_verify.py public/character/<state> <old frames dir>
# Walk/stretch clips were per-frame cropped: run with LUMIO_MATCH=perframe.
cd "$(dirname "$0")/../.."
PY="${LUMIO_PY:-/Users/supertail/Desktop/Background remover/.venv/bin/python}"
FF=$(node -p "require('ffmpeg-static')")
WORK="${WORK:-/tmp/companion-lumio}"; mkdir -p "$WORK"
for pair in "$@"; do
  clip=${pair%%:*}; st=${pair##*:}
  echo "START $clip -> $st $(date +%H:%M:%S)"
  "$PY" scripts/lumio_cutout.py "assets/clips/$clip.mp4" "$WORK/$st" "$FF" < /dev/null 2>&1 | grep -E "CUTOUT_DONE|Error|Traceback"
  "$PY" scripts/lumio_match.py "$WORK/$st" "public/character/$st" < /dev/null 2>&1 | grep -E "MATCHED|MISMATCH|NO_CHAR|Error|Traceback"
done
