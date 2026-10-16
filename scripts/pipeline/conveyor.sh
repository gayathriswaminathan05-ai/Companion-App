#!/bin/bash
# Background conveyor: while Higgsfield clips are still generating, append
# "clip state" lines to $WORK/queue.txt; each is turned into an app animation
# (sprite-in.sh) exactly once. A line "END" stops it.
# The queue is read on fd 3 and every job gets </dev/null, so ffmpeg/python
# can't swallow queue lines from stdin.
cd "$(dirname "$0")/../.."
WORK="${WORK:-/tmp/companion-lumio}"; mkdir -p "$WORK"
touch "$WORK/queue.txt" "$WORK/queue.done"
while true; do
  while read -r clip st <&3; do
    [ -z "$clip" ] && continue
    [ "$clip" = "END" ] && { echo "CONVEYOR_END"; exit 0; }
    grep -qx "$clip $st" "$WORK/queue.done" && continue
    [ -f "assets/clips/$clip.mp4" ] || { echo "MISSING $clip"; echo "$clip $st" >> "$WORK/queue.done"; continue; }
    echo "== $clip -> $st $(date +%H:%M:%S)"
    scripts/pipeline/sprite-in.sh "$clip" "$st" < /dev/null
    echo "$clip $st" >> "$WORK/queue.done"
    echo "READY $st"
  done 3< "$WORK/queue.txt"
  sleep 10
done
