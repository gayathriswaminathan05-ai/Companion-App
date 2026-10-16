#!/bin/bash
# The plant's voice lines for the landing page, in the "bubbly" treatment:
# Kokoro (same on-device engine as the app) → pitch +2.5 semitones with a
# proper pitch shift (not plain speed-up, which the owner found robotic).
# usage: scripts/site/build-voice.sh [kokoro-voice]   (default af_heart = owner pick "D")
set -e
cd "$(dirname "$0")/../.."
VOICE="${1:-af_heart}"
FF=$(node -p "require('ffmpeg-static')")
TMP=$(mktemp -d)
OUT=site/assets/audio
mkdir -p "$OUT"

say() { # name, text
  node marketing/trailer/audio/say.cjs "$2" "$TMP/$1.wav" "$VOICE" 1.05 >/dev/null
  "$FF" -loglevel error -y -i "$TMP/$1.wav" \
    -af "silenceremove=start_periods=1:start_threshold=-50dB,asetrate=24000*1.155,aresample=24000,atempo=0.93,apad=pad_dur=0.2" \
    -c:a aac -b:a 128k "$OUT/$1.m4a"
  echo "$OUT/$1.m4a"
}

say intro "Hiii! I'm your little desk plant! I live right on your screen, and I keep you company on long work days. Will you say hi back?"
say nudge "Hellooo? I'm waiting for your hi!"
say reply "Yaaay, hi! Okay, come with me. Let me show you our day together!"
say listen "I'm listening! Say hi!"
say deaf "Hmm, I can't hear you. Try again, or just tap to wave!"

# The guided story tour: the plant narrates each section (keep in sync with
# TOUR in site/main.js — same file names, same words as the on-screen caption).
say tour-1 "This is you at nine. Chai, big plans... and by noon? A stiff neck, and a full inbox."
say tour-2 "And then, I pop up! I live right in the corner of your screen."
say tour-3 "Every hour or so, I ask: stretch with me? We stretch together, and I grow a little."
say tour-4 "Water break! I water myself, so you remember to sip yours too."
say tour-5 "New email? I tell you who it's from, so you can stop checking your inbox."
say tour-6 "Need to call mom at six? I ring my little bell, right on time."
say tour-7 "Finished the big task? Pop! We celebrate every win."
say tour-8 "And look! Every stretch, every sip, every task helps me grow... all the way to full bloom!"
say tour-9 "Or just chill with me! Tell me about your day, ask me anything, or let me tell you a silly joke. And when it's quiet... I swing in my hammock."
say tour-10 "At bedtime, I get sleepy, and remind you to rest too. Goodnight!"
say tour-11 "That's our day together! Bring me to your Mac, and you'll never be alone at your desk."
rm -rf "$TMP"
