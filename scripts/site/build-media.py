"""Media for the beta landing page (site/).

- trailer shots → 720p H.264 web videos + poster frames
- plant animations → looping animated WebP (transparent) from public/character
- favicon from the stage icons

usage: python scripts/site/build-media.py <ffmpeg>
Re-run after new trailer shots or plant art. Output: site/assets/{video,plant}/
"""
import glob
import os
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FF = sys.argv[1]
OUT = os.path.join(ROOT, "site", "assets")
SHOTS = os.path.join(ROOT, "marketing", "trailer", "shots")
CHAR = os.path.join(ROOT, "public", "character")

VIDEOS = ["01-struggle", "04-hello", "05-stretch-v2", "06a-water", "06b-email", "07-callmom", "08-win", "09-goodnight"]
# Poster = a frame that tells the story at a glance (seconds into the shot).
POSTER_AT = {"01-struggle": 3.6, "04-hello": 4.6, "05-stretch-v2": 4.8, "06a-water": 4.4,
             "06b-email": 4.6, "07-callmom": 1.2, "08-win": 4.2, "09-goodnight": 1.0}

# name → (character state, frame step, fps, pingpong). Idles breathe slowly, so
# every 2nd frame at 6fps looks the same at half the size; waves keep 12fps.
PLANTS = {f"stage-{n}": (f"growth{n}", 2, 6, True) for n in range(1, 8)}
PLANTS.update({"wave-5": ("waving5", 1, 12, False), "wave-7": ("waving7", 1, 12, False),
               "hammock-7": ("hammock7", 2, 6, True)})
# Version B feature animations: (state, step, fps, pingpong, first, last, hold-last ms)
FEATURES = {
    "feat-stretch": ("stretching5", 2, 8, True, 1, 56, 0),  # side bends only (walk cut)
    "feat-water": ("watering5", 1, 12, True, 1, 18, 0),
    "feat-bell": ("meeting5", 1, 12, False, 1, 51, 600),
    "feat-coffee": ("coffee5", 2, 6, True, 1, 61, 0),
    "feat-cheers": ("celebrating7", 1, 16, False, 1, 48, 1600),
    "feat-sleep": ("sleeping7", 1, 12, False, 1, 61, 3200),
}
PLANT_H = 300


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def videos():
    os.makedirs(os.path.join(OUT, "video"), exist_ok=True)
    for v in VIDEOS:
        src = os.path.join(SHOTS, f"{v}.mp4")
        dst = os.path.join(OUT, "video", f"{v}.mp4")
        run(FF, "-y", "-i", src, "-vf", "scale=1280:-2", "-c:v", "libx264", "-preset", "slow", "-crf", "26",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", dst)
        run(FF, "-y", "-ss", str(POSTER_AT[v]), "-i", src, "-frames:v", "1", "-vf", "scale=1280:-2",
            "-q:v", "4", os.path.join(OUT, "video", f"{v}.jpg"))
        print(f"video {v}: {os.path.getsize(dst) // 1024} KB")


def plants():
    os.makedirs(os.path.join(OUT, "plant"), exist_ok=True)
    for name, (state, step, fps, pingpong) in PLANTS.items():
        files = sorted(glob.glob(os.path.join(CHAR, state, "f-*.png")))[::step]
        frames = []
        for f in files:
            im = Image.open(f).convert("RGBA")
            frames.append(im.resize((round(im.width * PLANT_H / im.height), PLANT_H), Image.LANCZOS))
        seq = frames + frames[-2:0:-1] if pingpong else frames
        dst = os.path.join(OUT, "plant", f"{name}.webp")
        seq[0].save(dst, "WEBP", save_all=True, append_images=seq[1:], duration=round(1000 / fps),
                    loop=0, quality=70, method=4, minimize_size=True)
        # First frame as a still: instant paint + reduced-motion fallback.
        frames[0].save(os.path.join(OUT, "plant", f"{name}-still.webp"), "WEBP", quality=80)
        print(f"plant {name}: {len(seq)} frames, {os.path.getsize(dst) // 1024} KB")


def features():
    os.makedirs(os.path.join(OUT, "plant"), exist_ok=True)
    for name, (state, step, fps, pingpong, first, last, hold) in FEATURES.items():
        files = sorted(glob.glob(os.path.join(CHAR, state, "f-*.png")))[first - 1:last][::step]
        frames = []
        for f in files:
            im = Image.open(f).convert("RGBA")
            frames.append(im.resize((round(im.width * PLANT_H / im.height), PLANT_H), Image.LANCZOS))
        seq = frames + frames[-2:0:-1] if pingpong else frames
        dur = [round(1000 / fps)] * len(seq)
        if hold:
            dur[-1] = hold  # story clips rest on their last pose before replaying
        dst = os.path.join(OUT, "plant", f"{name}.webp")
        seq[0].save(dst, "WEBP", save_all=True, append_images=seq[1:], duration=dur,
                    loop=0, quality=70, method=4, minimize_size=True)
        frames[0].save(os.path.join(OUT, "plant", f"{name}-still.webp"), "WEBP", quality=80)
        frames[-1].save(os.path.join(OUT, "plant", f"{name}-end.webp"), "WEBP", quality=80)
        print(f"feature {name}: {len(seq)} frames, {os.path.getsize(dst) // 1024} KB")


def icons():
    src = os.path.join(ROOT, "public", "icons")
    os.makedirs(os.path.join(OUT, "icons"), exist_ok=True)
    for n in range(1, 8):
        Image.open(os.path.join(src, f"stage-{n}.png")).save(os.path.join(OUT, "icons", f"stage-{n}.png"), optimize=True)
    fav = Image.open(os.path.join(src, "stage-5.png")).convert("RGBA").resize((64, 64), Image.LANCZOS)
    fav.save(os.path.join(OUT, "favicon.png"), optimize=True)


if __name__ == "__main__":
    which = sys.argv[2:] or ["videos", "plants", "features", "icons"]
    if "features" in which:
        features()
    if "icons" in which:
        icons()
    if "plants" in which:
        plants()
    if "videos" in which:
        videos()
