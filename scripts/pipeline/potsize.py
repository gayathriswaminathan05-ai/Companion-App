# Pot-size check: on-screen pot RIM width of a pose vs that stage's idle, so
# poses don't look bigger/smaller than the plant at rest. Run from repo root:
#   python scripts/pipeline/potsize.py waving5 coffee6 sleeping7

# On-screen pot RIM width per state vs that stage's idle (rim band avoids arms).
import re, glob, sys
from PIL import Image
import numpy as np
src = open("src/generated/sprites.ts").read()
def meta(name):
    m = re.search(r'"%s":\s*\{(.*?)\n  \}' % name, src, re.S)
    if not m: return None
    b = m.group(1)
    w = re.search(r'"srcW":\s*(\d+)', b); h = re.search(r'"srcH":\s*(\d+)', b)
    return (int(w.group(1)), int(h.group(1))) if w and h else None
fit = lambda m: min(408 / m[0], 480 / m[1])
base = meta("idle")
def scale(name):
    m = meta(name)
    s = max(.7, min(1.45, fit(base) / fit(m)))
    if name == "growth7": s = min(1.6, s * 1.09)
    return s
def rim_old(path):
    arr = np.array(Image.open(path).convert("RGBA")).astype(int)
    r, g, b, a = [arr[..., i] for i in range(4)]
    pot = (a > 40) & (r > 110) & (r > g + 10) & (r > b + 35) & (b < 150) & (g > 40) & (g < 200)
    rows = pot.sum(1); ys = np.where(rows > 15)[0]
    if not len(ys): return 0
    y0, y1 = ys.min(), ys.max()
    best = 0
    for y in range(y0, int(y0 + 0.2 * (y1 - y0)) + 1):
        xs = np.where(pot[y])[0]
        if len(xs) >= 20: best = max(best, xs.max() - xs.min() + 1)
    return best
def rim(path):
    # median row width over the pot's middle band (robust to arms + leaves)
    arr = np.array(Image.open(path).convert("RGBA")).astype(int)
    r, g, b, a = [arr[..., i] for i in range(4)]
    pot = (a > 40) & (r > 110) & (r > g + 10) & (r > b + 35) & (b < 150) & (g > 30) & (g < 200)
    rows = pot.sum(1); ys = np.where(rows > 15)[0]
    if not len(ys): return 0
    y0, y1 = ys.min(), ys.max(); h = y1 - y0
    ws = []
    for y in range(int(y0 + 0.2 * h), int(y0 + 0.8 * h) + 1):
        xs = np.where(pot[y])[0]
        if len(xs) >= 20: ws.append(xs.max() - xs.min() + 1)
    return float(np.median(ws)) if ws else 0
for st in sys.argv[1:]:
    n = re.search(r"(\d)$", st); n = n.group(1) if n else "4"
    idle = f"growth{n}"
    f = sorted(glob.glob(f"public/character/{st}/f-*.png"))
    g = sorted(glob.glob(f"public/character/{idle}/f-*.png"))
    if not f or not meta(st): print(st, "-"); continue
    cw = np.median([rim(p) for p in f[:3]]) * scale(st)
    iw = rim(g[0]) * scale(idle)
    print(f"{st}: pose rim {cw:.0f}px vs {idle} {iw:.0f}px -> {cw/iw*100:.0f}%  (pose scale {scale(st):.2f})")
