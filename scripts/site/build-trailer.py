"""The trailer for the landing pages: the 8 scenes joined with short crossfades,
NARRATED BY THE PLANT (owner: the old merge "sounds very robotic").

Picture: marketing/trailer/shots/<scene>-silent.mp4
Sound:   bed-*.wav (room tone, foley and the app's chirps, no voice lines;
         made with marketing/trailer/audio/mix_shot.py) + narr-N.wav (the plant,
         voice D, made with marketing/trailer/audio/narrate.sh). The bed dips a
         little whenever the plant speaks.
→ site/assets/video/trailer.mp4 (720p) + trailer.jpg

usage: python scripts/site/build-trailer.py <ffmpeg>
"""
import os
import re
import subprocess
import sys
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FF = sys.argv[1]
SHOTS = os.path.join(ROOT, "marketing", "trailer", "shots")
AUDIO = os.path.join(ROOT, "marketing", "trailer", "audio")
OUT = os.path.join(ROOT, "site", "assets", "video")
SR = 48000
FADE = 0.4  # seconds of crossfade between scenes

# scene, background bed, narration line, when it starts inside the scene (s)
SCENES = [
    ("01-struggle", "bed-01", 1, 0.6),
    ("04-hello", "bed-04", 2, 1.6),  # right after the plant pops up
    ("05-stretch-v2", "bed-05", 3, 0.6),
    ("06a-water", "bed-06a", 4, 0.6),
    ("06b-email", "bed-06b", 5, 1.3),
    ("07-callmom", "bed-07", 6, 0.5),
    ("08-win", "bed-08", 7, 1.2),
    ("09-goodnight", "bed-09", 8, 0.7),
]
BED_GAIN = 0.85
DUCK = 0.45  # bed level while the plant talks
NARR_GAIN = 1.0


def duration(path):
    out = subprocess.run([FF, "-i", path], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def load(path):
    raw = subprocess.run([FF, "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


videos = [os.path.join(SHOTS, f"{s}-silent.mp4") for s, *_ in SCENES]
durs = [duration(v) for v in videos]
starts = [sum(durs[:i]) - i * FADE for i in range(len(durs))]
total = starts[-1] + durs[-1]
n = int(total * SR) + SR

# --- sound ---
bed = np.zeros(n)
voice = np.zeros(n)
for (scene, bed_name, line, at), t0, d in zip(SCENES, starts, durs):
    b = load(os.path.join(AUDIO, f"{bed_name}.wav"))[: int(d * SR)]
    ramp = int(FADE * SR)
    env = np.ones(len(b))
    env[:ramp] = np.linspace(0, 1, ramp)  # crossfade in…
    env[-ramp:] = np.linspace(1, 0, ramp)  # …and out, overlapping the next scene
    i0 = int(t0 * SR)
    bed[i0 : i0 + len(b)] += b * env
    v = load(os.path.join(AUDIO, f"narr-{line}.wav"))
    j0 = int((t0 + at) * SR)
    voice[j0 : j0 + len(v)] += v

# Duck the bed under the voice (smoothed ~150 ms).
talking = (np.abs(voice) > 1e-3).astype(float)
k = int(0.15 * SR)
kernel = np.ones(k) / k
cover = np.clip(np.convolve(np.convolve(talking, np.ones(int(0.25 * SR)), "same") > 0, kernel, "same"), 0, 1)
mix = bed * BED_GAIN * (1 - (1 - DUCK) * cover) + voice * NARR_GAIN
# gentle overall fade in/out, then normalise to -1 dBFS peak
fi, fo = int(0.4 * SR), int(0.8 * SR)
end = int(total * SR)
mix = mix[:end]
mix[:fi] *= np.linspace(0, 1, fi)
mix[-fo:] *= np.linspace(1, 0, fo)
mix *= 0.89 / max(1e-6, np.abs(mix).max())

tmp = tempfile.mkdtemp()
wav = os.path.join(tmp, "trailer.wav")
with wave.open(wav, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    w.writeframes(np.repeat(pcm, 2).tobytes())

# --- picture: crossfaded scenes + fade in/out from black (it plays in a dark player), muxed with the sound ---
args = [FF, "-y"]
for v in videos:
    args += ["-i", v]
args += ["-i", wav]
parts = [f"[{i}:v]scale=1280:720,fps=24,format=yuv420p,setsar=1[v{i}]" for i in range(len(videos))]
cur, t = "v0", durs[0]
for i in range(1, len(videos)):
    parts.append(f"[{cur}][v{i}]xfade=transition=fade:duration={FADE}:offset={t - FADE:.3f}[vx{i}]")
    cur, t = f"vx{i}", t + durs[i] - FADE
parts.append(f"[{cur}]fade=t=in:st=0:d=0.5:color=black,fade=t=out:st={t - 0.8:.3f}:d=0.8:color=black[vout]")
dst = os.path.join(OUT, "trailer.mp4")
args += ["-filter_complex", ";".join(parts), "-map", "[vout]", "-map", f"{len(videos)}:a",
         "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-c:a", "aac", "-b:a", "128k",
         "-shortest", "-movflags", "+faststart", dst]
subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# Poster: the plant waving hello on his screen.
subprocess.run([FF, "-y", "-ss", f"{starts[1] + 4.4:.2f}", "-i", dst, "-frames:v", "1", "-q:v", "3",
                os.path.join(OUT, "trailer.jpg")], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(f"trailer: {total:.1f}s, {os.path.getsize(dst) // 1024} KB, narration lines at "
      + ", ".join(f"{s + a:.1f}s" for s, (_, _, _, a) in zip(starts, SCENES)))
