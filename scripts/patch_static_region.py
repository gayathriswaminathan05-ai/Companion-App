"""Repair a region that should never move (e.g. a hammock post) in a sprite state.

Kling sometimes smears a static prop for a few frames. For every frame whose
pixels inside columns x0..x1 drift from the reference frame by more than
`thresh` (mean abs RGBA), copy that column band from the reference frame.

usage: python scripts/patch_static_region.py <state_dir> <x0> <x1> [ref_frame=1] [thresh=3]
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

state_dir, x0, x1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
ref_n = int(sys.argv[4]) if len(sys.argv) > 4 else 1
thresh = float(sys.argv[5]) if len(sys.argv) > 5 else 3.0

frames = sorted(glob.glob(os.path.join(state_dir, "f-*.png")))
ref = np.array(Image.open(frames[ref_n - 1]).convert("RGBA"))
patched = []
for f in frames:
    im = np.array(Image.open(f).convert("RGBA"))
    band = slice(x0, x1 + 1)
    if np.abs(im[:, band].astype(int) - ref[:, band].astype(int)).mean() > thresh:
        im[:, band] = ref[:, band]
        Image.fromarray(im).save(f)
        patched.append(os.path.basename(f))
print(f"patched {len(patched)} frames: {' '.join(patched)}")
