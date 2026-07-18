#!/usr/bin/env python3
"""Polish keyed character sprites — strip white fringe / leftover ground.

Only removes pale/near-white matte pixels (and a 1px silhouette shave).
Does NOT recolor edges (a previous despill path overflowed and created
pure-white halos).

Usage:
  python3 scripts/polish-sprites.py
  python3 scripts/polish-sprites.py idle lying
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "character"


def touches_clear(a: np.ndarray, thresh: int = 28) -> np.ndarray:
    clear = a < thresh
    pad = np.pad(clear, 1, constant_values=True)
    return (
        pad[0:-2, 0:-2] | pad[0:-2, 1:-1] | pad[0:-2, 2:]
        | pad[1:-1, 0:-2] | pad[1:-1, 2:]
        | pad[2:, 0:-2] | pad[2:, 1:-1] | pad[2:, 2:]
    )


def polish_arr(rgba: np.ndarray) -> tuple[np.ndarray, dict]:
    rgb = rgba[..., :3].astype(np.float64).copy()
    a = rgba[..., 3].astype(np.float64).copy()
    stats = {"erode": 0, "pale": 0, "pocket": 0}

    def opaque(t: int = 28) -> np.ndarray:
        return a >= t

    def kill(mask: np.ndarray) -> int:
        nonlocal a
        n = int(mask.sum())
        if n:
            a = np.where(mask, 0, a)
        return n

    def pale_edge_mask() -> np.ndarray:
        t = touches_clear(a)
        lum = rgb.sum(axis=2) / 3.0
        chroma = rgb.max(axis=2) - rgb.min(axis=2)
        dist_w = np.sqrt(((255.0 - rgb) ** 2).sum(axis=2))
        # Local interior luminance (solid neighbors only)
        solid = opaque(160) & ~t & ~((lum > 200) & (chroma <= 28))
        pad_l = np.pad(np.where(solid, lum, 0.0), 1)
        pad_s = np.pad(solid, 1)
        sum_l = (
            pad_l[0:-2, 0:-2] + pad_l[0:-2, 1:-1] + pad_l[0:-2, 2:]
            + pad_l[1:-1, 0:-2] + pad_l[1:-1, 2:]
            + pad_l[2:, 0:-2] + pad_l[2:, 1:-1] + pad_l[2:, 2:]
        )
        cnt = (
            pad_s[0:-2, 0:-2] + pad_s[0:-2, 1:-1] + pad_s[0:-2, 2:]
            + pad_s[1:-1, 0:-2] + pad_s[1:-1, 2:]
            + pad_s[2:, 0:-2] + pad_s[2:, 1:-1] + pad_s[2:, 2:]
        ).astype(np.float64)
        avg_l = np.divide(sum_l, cnt, out=np.zeros_like(sum_l), where=cnt > 0)
        dark = opaque() & (lum < 100)
        pad_d = np.pad(dark, 1)
        dark_n = (
            pad_d[0:-2, 0:-2] + pad_d[0:-2, 1:-1] + pad_d[0:-2, 2:]
            + pad_d[1:-1, 0:-2] + pad_d[1:-1, 2:]
            + pad_d[2:, 0:-2] + pad_d[2:, 1:-1] + pad_d[2:, 2:]
        )
        eyeish = opaque() & (lum > 170) & (dark_n >= 3)
        return opaque() & t & ~eyeish & (
            ((dist_w < 55))  # nearly pure white
            | ((dist_w < 95) & (chroma <= 20))  # light gray / white matte
            | ((lum > 210) & (chroma <= 16))
            | ((cnt > 0) & (lum > avg_l + 28) & (lum > 175) & (chroma <= 30))
            | ((a < 100) & (lum > 190) & (chroma <= 25))
            | ((rgb.min(axis=2) >= 248) & (chroma <= 8))
        )

    def floor_pale_mask() -> np.ndarray:
        """Extra aggression for leftover white/gray ground under feet."""
        t = touches_clear(a)
        lum = rgb.sum(axis=2) / 3.0
        chroma = rgb.max(axis=2) - rgb.min(axis=2)
        # opaque bbox
        ys, xs = np.where(opaque())
        if len(ys) == 0:
            return np.zeros(a.shape, dtype=bool)
        y0, y1 = ys.min(), ys.max()
        cut = y0 + int((y1 - y0) * 0.62)  # lower ~38% of character
        bottom = np.zeros(a.shape, dtype=bool)
        bottom[cut:, :] = True
        # protect eye-like: bright pixel with mostly dark neighbors
        pad_a = np.pad(a, 1)
        # count dark opaque neighbors
        dark = opaque() & (lum < 100)
        pad_d = np.pad(dark, 1)
        dark_n = (
            pad_d[0:-2, 0:-2] + pad_d[0:-2, 1:-1] + pad_d[0:-2, 2:]
            + pad_d[1:-1, 0:-2] + pad_d[1:-1, 2:]
            + pad_d[2:, 0:-2] + pad_d[2:, 1:-1] + pad_d[2:, 2:]
        )
        eyeish = opaque() & (lum > 180) & (dark_n >= 3)
        return (
            opaque()
            & t
            & bottom
            & ~eyeish
            & (
                # Neutral gray/white ground only — not peach terracotta AA
                ((lum > 170) & (chroma <= 22))
                | ((lum > 200) & (chroma <= 32))
                | ((rgb.min(axis=2) >= 230) & (chroma <= 18))
            )
        )

    # --- 1) Skip hard silhouette erode (it nicked eyes). Pale peel only. ---

    # --- 2) Peel pale / white fringe + floor (multi-px) ---
    for _ in range(16):
        n = kill(pale_edge_mask())
        stats["pale"] += n
        if n == 0:
            break

    # --- 2b) Extra floor/ground pale peel (neutral gray/white only) ---
    for _ in range(14):
        n = kill(floor_pale_mask())
        stats["pale"] += n
        if n == 0:
            break

    # --- 3) Enclosed near-white pockets (between leaves) ---
    lum = rgb.sum(axis=2) / 3.0
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    near = opaque() & (lum >= 200) & (chroma <= 24)
    visited = np.zeros(a.shape, dtype=bool)
    h, w = a.shape
    ys, xs = np.where(near)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if visited[y0, x0] or a[y0, x0] < 28:
            continue
        stack = [(x0, y0)]
        visited[y0, x0] = True
        comp: list[tuple[int, int]] = []
        touches_t = False
        dark_n = green_n = border_n = 0
        while stack:
            x, y = stack.pop()
            comp.append((x, y))
            for dx, dy in (
                (-1, 0), (1, 0), (0, -1), (0, 1),
                (-1, -1), (1, -1), (-1, 1), (1, 1),
            ):
                nx, ny = x + dx, y + dy
                if nx < 0 or ny < 0 or nx >= w or ny >= h:
                    touches_t = True
                    continue
                if a[ny, nx] < 28:
                    touches_t = True
                    continue
                if near[ny, nx]:
                    if not visited[ny, nx]:
                        visited[ny, nx] = True
                        stack.append((nx, ny))
                else:
                    border_n += 1
                    if lum[ny, nx] < 90:
                        dark_n += 1
                    nr, ng, nb = rgb[ny, nx]
                    if ng > nr + 15 and ng > nb + 15 and ng > 80:
                        green_n += 1
        size = len(comp)
        dark_ratio = dark_n / max(1, border_n)
        green_ratio = green_n / max(1, border_n)
        keep_eye = size <= 55 and dark_ratio >= 0.45 and not touches_t
        # Coffee mug / cream props: large near-white regions — never delete
        # just because they touch the outline.
        cy = sum(y for _, y in comp) / size
        ys_op = np.where(opaque())[0]
        y_mid = float(ys_op.mean()) if len(ys_op) else h / 2
        is_prop = size >= 90 and green_ratio < 0.2 and dark_ratio < 0.35
        is_floor_blob = size >= 40 and cy > y_mid + 20 and green_ratio < 0.15
        drop = False
        if keep_eye or is_prop:
            drop = False
        elif green_ratio >= 0.25:
            drop = True  # white between leaves
        elif is_floor_blob and touches_t:
            drop = True  # leftover ground under feet
        elif touches_t and size < 70:
            drop = True  # small edge white pockets
        elif (not touches_t) and size >= 60 and green_ratio >= 0.15:
            drop = True
        if drop:
            for x, y in comp:
                a[y, x] = 0
                stats["pocket"] += 1

    # --- 4) Peel again after pockets (new edges may be pale) ---
    for _ in range(6):
        n = kill(pale_edge_mask())
        stats["pale"] += n
        if n == 0:
            break

    # --- 5) Soft feather only (no RGB invention) ---
    t = touches_clear(a)
    a = np.where(opaque() & t & (a > 160), np.minimum(a, 150), a)

    out = np.dstack(
        [
            np.clip(rgb, 0, 255).astype(np.uint8),
            np.clip(a, 0, 255).astype(np.uint8),
        ]
    )
    return out, stats


def main() -> None:
    wanted = set(sys.argv[1:])
    states = sorted(p.name for p in ROOT.iterdir() if p.is_dir())
    if wanted:
        states = [s for s in states if s in wanted]
    total = {"erode": 0, "pale": 0, "pocket": 0, "files": 0}
    for s in states:
        files = sorted((ROOT / s).glob("f-*.png"))
        print(f"{s}: {len(files)} frames…", flush=True)
        for f in files:
            arr = np.array(Image.open(f).convert("RGBA"))
            out, st = polish_arr(arr)
            Image.fromarray(out).save(f, optimize=True)
            for k in ("erode", "pale", "pocket"):
                total[k] += st[k]
            total["files"] += 1
    print(
        f"done ✓ {total['files']} frames — "
        f"erode={total['erode']} pale={total['pale']} pocket={total['pocket']}"
    )


if __name__ == "__main__":
    main()
