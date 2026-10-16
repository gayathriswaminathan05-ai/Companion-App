"""Check placed Lumio frames against the old frames, frame by frame.

Prints the worst drift of the body box (centre-x, bottom, height) in pixels
of the 340x400 canvas. Big drift = the old frames were cropped per frame
(character re-centred every frame), so place with LUMIO_MATCH=perframe.

  python scripts/lumio_verify.py <state_dir> <ref_dir (old frames)>
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from lumio_match import bbox  # noqa: E402

state_dir, ref_dir = sys.argv[1], sys.argv[2]
names = sorted(f for f in os.listdir(ref_dir) if f.endswith(".png"))
worst = (0, 0, 0)
for n in names:
    a, b = bbox(Image.open(os.path.join(state_dir, n))), bbox(Image.open(os.path.join(ref_dir, n)))
    if not a or not b:
        continue
    d = (abs((a[0] + a[2]) - (b[0] + b[2])) / 2, abs(a[3] - b[3]), abs((a[3] - a[1]) - (b[3] - b[1])))
    worst = tuple(max(w, x) for w, x in zip(worst, d))
print(f"DRIFT x={worst[0]:.0f} bottom={worst[1]:.0f} height={worst[2]:.0f}")
