"""Soften any part of a cut-out that touches the frame edge (e.g. a blanket the
AI let run out of frame), so the app never shows a hard straight cut.
  python feather_edges.py <dir of RGBA frames> [ramp_px]"""
import os, sys
import numpy as np
from PIL import Image
d = sys.argv[1]; ramp = int(sys.argv[2]) if len(sys.argv) > 2 else 28
for f in sorted(os.listdir(d)):
    if not f.endswith(".png"): continue
    im = Image.open(os.path.join(d, f)).convert("RGBA"); a = np.asarray(im).copy()
    al = a[..., 3].astype(np.float64); h, w = al.shape; changed = False
    r = np.clip(np.arange(ramp) / ramp, 0, 1)
    if al[:, :2].max() > 24: al[:, :ramp] *= r[None, :]; changed = True
    if al[:, -2:].max() > 24: al[:, -ramp:] *= r[::-1][None, :]; changed = True
    if al[:2, :].max() > 24: al[:ramp, :] *= r[:, None]; changed = True
    if changed:
        a[..., 3] = al.round().clip(0, 255).astype(np.uint8)
        Image.fromarray(a, "RGBA").save(os.path.join(d, f))
print("feathered", d)
