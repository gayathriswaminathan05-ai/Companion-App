#!/bin/bash
# strip.sh <video> <out.png> : 10 frames across the clip, labelled with seconds
FF=$(cd "/Users/supertail/Desktop/Companion app" && node -p "require('ffmpeg-static')")
"$FF" -loglevel error -y -i "$1" -vf "fps=2,scale=200:-1,drawtext=text='%{pts\:hms}':x=4:y=4:fontsize=14:fontcolor=red,tile=10x1" -frames:v 1 "$2" 2>/dev/null || "$FF" -loglevel error -y -i "$1" -vf "fps=2,scale=200:-1,tile=10x1" -frames:v 1 "$2"
