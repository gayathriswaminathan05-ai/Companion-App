#!/usr/bin/env python3
"""Gentle edge-only cleanup for draggedgrowth sprites.

Only touches pixels on the silhouette edge (next to transparency).
Never punches holes in eyes/mouth/interior.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "character"


def touches_clear(a: np.ndarray, thresh: int = 20) -> np.ndarray:
    clear = a < thresh
    pad = np.pad(clear, 1, constant_values=True)
    return (
        pad[0:-2, 0:-2] | pad[0:-2, 1:-1] | pad[0:-2, 2:]
        | pad[1:-1, 0:-2] | pad[1:-1, 2:]
        | pad[2:, 0:-2] | pad[2:, 1:-1] | pad[2:, 2:]
    )


def clean(path: Path) -> int:
    arr = np.array(Image.open(path).convert("RGBA"))
    rgb = arr[..., :3].astype(np.int16)
    a = arr[..., 3].astype(np.int16)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    edge = (a >= 20) & touches_clear(a)

    # Protect character body colors even on the edge
    green = (g > r + 10) & (g > b + 10) & (g > 55)
    pot = (r > 110) & (r > g + 15) & (r > b + 15) & (g > 35) & (g < 210)
    blush = (r > 150) & (b > 95) & (g > 60) & (g < 185) & (r > g)
    soil = (r < 120) & (g < 95) & (b < 85) & (a > 40) & (r + g + b > 40)
    # Dark eyes / mouth — never clear these
    dark_face = (r + g + b < 140) & (a > 40) & (g < 90)
    protect = green | pot | blush | soil | dark_face

    # Magenta / hot-pink plate spill on edge only
    magenta = (r > 155) & (b > 135) & (g < 125) & (g < r - 40) & (g < b - 30)
    # White / pale matte on edge only
    lum = (r.astype(np.int32) + g + b) / 3
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    pale = (lum > 205) & (chroma < 28)
    near_white = (r > 230) & (g > 230) & (b > 230)

    kill = edge & ~protect & (magenta | pale | near_white)
    n = int(kill.sum())
    a = np.where(kill, 0, a)

    # Soften remaining edge a touch (no color change)
    edge2 = (a >= 20) & touches_clear(a.astype(np.uint8))
    a = np.where(edge2 & (a > 180), np.minimum(a, 160), a)

    out = np.dstack([rgb.astype(np.uint8), a.astype(np.uint8)])
    Image.fromarray(out).save(path)
    return n


def main() -> None:
    names = sys.argv[1:] or [f"draggedgrowth{i}" for i in range(1, 7)]
    for name in names:
        d = ROOT / name
        total = 0
        files = sorted(d.glob("f-*.png"))
        for p in files:
            total += clean(p)
        print(f"{name}: {len(files)} frames, edge-killed {total}")


if __name__ == "__main__":
    main()
