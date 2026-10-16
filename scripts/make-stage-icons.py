"""Colour growth-stage icons from the real plant art.

public/character/growthN/f-001.png → cropped to the plant, centred on a
square transparent canvas → public/icons/stage-N.png (128px). Re-run after
any growth idle clip is regenerated.

usage: python scripts/make-stage-icons.py
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "icons")
SIZE = 128
os.makedirs(OUT, exist_ok=True)

for n in range(1, 8):
    src = os.path.join(ROOT, "public", "character", f"growth{n}", "f-001.png")
    im = Image.open(src).convert("RGBA")
    box = im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    im = im.crop(box)
    side = max(im.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((side - im.width) // 2, side - im.height))  # sit on the bottom edge
    canvas.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, f"stage-{n}.png"), optimize=True)
    print(f"stage-{n}.png  plant {im.width}x{im.height}")
