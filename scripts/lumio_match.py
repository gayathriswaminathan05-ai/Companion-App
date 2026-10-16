"""Place Lumio cut-out frames EXACTLY where the existing sprite frames sit.

Every state's on-screen size was tuned against its current frames (srcW/srcH
meta, pot-scale fixes, per-stage corrections). New cut-outs come from the same
source video and timing, so we measure the character box in a few matching
frames, derive one scale + offset (the old pipeline used one static crop per
clip), and render all new frames into 340x400 with that transform. meta.json
and the manifest stay as they are, so sizes in the app don't move.

Usage (Lumio's venv python or any python with Pillow + numpy + scipy):
  python scripts/lumio_match.py <cutout_dir (540px frames)> <state_dir (public/character/<state>)> [ref_dir]

ref_dir: where the OLD frames are (default state_dir). Pass it when state_dir
was already overwritten, e.g. frames restored from git.
"""

import os
import statistics
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

W, H = 340, 400


def bbox(img: Image.Image):
    # Box of the character's solid pieces only: stray specks or faint floor
    # shadows the old keyer kept would otherwise stretch the box and skew the
    # scale. Pieces >= 2% of the biggest count (shoes on thin legs do).
    a = np.asarray(img.convert("RGBA"))[..., 3] > 128
    lab, n = ndimage.label(a)
    if n == 0:
        return None
    sizes = np.asarray(ndimage.sum(a, lab, range(1, n + 1)))
    keep = np.isin(lab, 1 + np.flatnonzero(sizes >= 0.02 * sizes.max()))
    ys, xs = np.where(keep)
    return xs.min(), ys.min(), xs.max(), ys.max()


def main():
    cut_dir, state_dir = sys.argv[1], sys.argv[2]
    ref_dir = sys.argv[3] if len(sys.argv) > 3 else state_dir
    new = sorted(f for f in os.listdir(cut_dir) if f.endswith(".png"))
    old = sorted(f for f in os.listdir(ref_dir) if f.endswith(".png"))
    if len(new) != len(old):
        raise SystemExit(f"FRAME_COUNT_MISMATCH new={len(new)} old={len(old)}")

    # Sample frames across the clip; median transform is robust to a frame
    # where the old keyer clipped a petal or the matte kept a faint wisp.
    picks = sorted({int(i) for i in np.linspace(0, len(new) - 1, 9)})
    scales, dxs, dys = [], [], []
    for i in picks:
        bn = bbox(Image.open(os.path.join(cut_dir, new[i])))
        bo = bbox(Image.open(os.path.join(ref_dir, old[i])))
        if not bn or not bo:
            continue
        s = ((bo[3] - bo[1]) / max(1, bn[3] - bn[1]) + (bo[2] - bo[0]) / max(1, bn[2] - bn[0])) / 2
        scales.append(s)
        # bottom-centre anchored, like the sprite pipeline
        dxs.append((bo[0] + bo[2]) / 2 - s * (bn[0] + bn[2]) / 2)
        dys.append(bo[3] - s * bn[3])
    if not scales:
        raise SystemExit("NO_CHARACTER_FOUND")
    s, dx, dy = statistics.median(scales), statistics.median(dxs), statistics.median(dys)

    # LUMIO_MATCH=perframe: the old frames were cropped per frame (walk clips,
    # CLIP_CROP=perframe), so the character was re-centred every frame. Follow
    # the old box frame by frame, smoothed ±4 frames like the old pipeline.
    per = None
    if os.environ.get("LUMIO_MATCH") == "perframe":
        raw = []
        for fn_new, fn_old in zip(new, old):
            bn = bbox(Image.open(os.path.join(cut_dir, fn_new)))
            bo = bbox(Image.open(os.path.join(ref_dir, fn_old)))
            if not bn or not bo:
                raw.append(None)
                continue
            fs = (bo[3] - bo[1]) / max(1, bn[3] - bn[1])
            raw.append((fs, (bo[0] + bo[2]) / 2 - fs * (bn[0] + bn[2]) / 2, bo[3] - fs * bn[3]))
        last = next(r for r in raw if r) if any(raw) else (s, dx, dy)
        for i, r in enumerate(raw):
            raw[i] = r or last
            last = raw[i]
        per = []
        for i in range(len(raw)):
            win = raw[max(0, i - 4): i + 5]
            per.append(tuple(sum(w[k] for w in win) / len(win) for k in range(3)))

    for i, (fn_new, fn_old) in enumerate(zip(new, old)):
        fs, fdx, fdy = per[i] if per else (s, dx, dy)
        src = Image.open(os.path.join(cut_dir, fn_new)).convert("RGBA")
        scaled = src.resize((max(1, round(src.width * fs)), max(1, round(src.height * fs))), Image.LANCZOS)
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        # Plain paste onto an empty canvas copies RGBA exactly (clips at edges).
        canvas.paste(scaled, (round(fdx), round(fdy)))
        canvas.save(os.path.join(state_dir, fn_old), optimize=True)
    print(f"MATCHED frames={len(new)} scale={s:.3f} dx={dx:.1f} dy={dy:.1f} spread={max(scales) - min(scales):.3f}")


if __name__ == "__main__":
    main()
