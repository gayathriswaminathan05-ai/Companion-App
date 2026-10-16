#!/bin/bash
# The plant narrates the trailer in its "bubbly" voice (owner pick D: Kokoro
# af_heart, pitch +2.5 semitones — same treatment as site/assets/audio).
# Writes marketing/trailer/audio/narr-N.wav (48k mono) for build-trailer.py.
set -e
cd "$(dirname "$0")/../../.."
FF=$(node -p "require('ffmpeg-static')")
TMP=$(mktemp -d)
OUT=marketing/trailer/audio

say() { # n, text
  node marketing/trailer/audio/say.cjs "$2" "$TMP/$1.wav" af_heart 1.05 >/dev/null
  "$FF" -loglevel error -y -i "$TMP/$1.wav" \
    -af "silenceremove=start_periods=1:start_threshold=-50dB,asetrate=24000*1.155,aresample=48000,atempo=0.93" \
    -ac 1 "$OUT/narr-$1.wav"
  echo "$OUT/narr-$1.wav"
}

say 1 "Long days. Just you, and the screen."
say 2 "That's where I come in! Hi, I'm your little desk plant."
say 3 "Every hour or so, I ask: stretch with me?"
say 4 "Water break! I water myself, so you remember to sip too."
say 5 "New email? I tell you who it's from, so you can stop checking."
say 6 "Call mom at six? I ring my little bell, right on time."
say 7 "Big task done? Pop! We celebrate every win."
say 8 "And at bedtime, we both rest. You're not alone at your desk."
rm -rf "$TMP"
