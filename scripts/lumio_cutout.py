"""Cut a character clip out of its background with Gayathri's Lumio tool.

Runs the same per-frame BiRefNet-matting + foreground-colour cleanup that the
Lumio app uses (~/Desktop/Background remover), but locally, full length and at
the frame size our sprite pipeline expects (12fps, 540px tall).

Usage (with Lumio's virtualenv):
  "/Users/supertail/Desktop/Background remover/.venv/bin/python" \
      scripts/lumio_cutout.py <video.mp4> <out_dir> [ffmpeg_path]

Then: CLIP_PREKEYED_DIR=<out_dir> node scripts/process-clip.cjs <video.mp4> <state>
"""

import os
import subprocess
import sys
import tempfile
import time

LUMIO = "/Users/supertail/Desktop/Background remover"
sys.path.insert(0, LUMIO)

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from bgremover import get_engine  # noqa: E402
from bgremover.core import _estimate_foreground  # noqa: E402

FPS = 12
HEIGHT = int(os.environ.get("LUMIO_HEIGHT", "540"))  # trailer close-ups use 1080
RES = int(os.environ.get("LUMIO_RES", "1024"))  # BiRefNet inference size; 768 is plenty for 540px frames


def main():
    src, out_dir = sys.argv[1], sys.argv[2]
    ffmpeg = sys.argv[3] if len(sys.argv) > 3 else "ffmpeg"
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(
            [ffmpeg, "-loglevel", "error", "-y", "-i", src, "-vf", f"fps={FPS},scale=-2:{HEIGHT}", "-an",
             os.path.join(tmp, "raw-%03d.png")],
            check=True,
        )
        frames = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
        eng = get_engine()
        t0 = time.time()
        for i, f in enumerate(frames, 1):
            out = os.path.join(out_dir, f"f-{i:03d}.png")
            if os.path.exists(out):
                continue
            rgb = Image.open(os.path.join(tmp, f)).convert("RGB")
            arr = np.asarray(rgb).astype(np.float32) / 255.0
            alpha = eng.alpha_matte(rgb, res=RES)
            fg = _estimate_foreground(arr, alpha)
            rgba = (np.dstack([fg, alpha]) * 255.0).round().astype(np.uint8)
            Image.fromarray(rgba, "RGBA").save(out)
        print(f"CUTOUT_DONE frames={len(frames)} secs={time.time() - t0:.1f}", flush=True)


if __name__ == "__main__":
    main()
