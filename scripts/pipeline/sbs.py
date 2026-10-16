# Side-by-side picture: stage idle | pose first frame | pose last frame at in-app scale.
#   python scripts/pipeline/sbs.py out.png waving5 sleeping6 ...

# Side-by-side at in-app scale: idle (growthN) | pose first frame, bottom-anchored, 408x480 box.
import re, glob, sys
from PIL import Image
src = open("src/generated/sprites.ts").read()
def meta(name):
    m = re.search(r'"%s":\s*\{(.*?)\n  \}' % name, src, re.S)
    b = m.group(1)
    g = lambda k: re.search(r'"%s":\s*([\d.]+)' % k, b)
    return {k: float(g(k).group(1)) for k in ("srcW", "srcH", "potScale") if g(k)}
fit = lambda m: min(408 / m["srcW"], 480 / m["srcH"])
base = meta("idle")
def scale(name):
    m = meta(name)
    pm = re.match(r"(?:coffee|waving|sleeping)(\d)$", name)
    if pm and "potScale" in m:
        return max(.6, min(1.8, scale("growth" + pm.group(1)) * m["potScale"]))
    s = max(.7, min(1.45, fit(base) / fit(m)))
    if name == "growth7": s = min(1.6, s * 1.09)
    return s
def tile(name, frame=0):
    f = sorted(glob.glob(f"public/character/{name}/f-*.png"))[frame]
    im = Image.open(f).convert("RGBA")
    # SpriteAnim draws the frame into the 408x480 fit box, then CSS-scales by scale()
    k = scale(name) * 0.5  # all PNGs are 340x400 drawn at the same size, then CSS scale()
    im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
    return im
out_rows = []
for st in sys.argv[2:]:
    n = re.search(r"(\d)$", st).group(1)
    ims = [tile(f"growth{n}"), tile(st, 0), tile(st, -1)]
    W = sum(i.width for i in ims) + 40; H = max(i.height for i in ims)
    row = Image.new("RGBA", (W, H + 10), (235, 232, 245, 255)); x = 0
    for i in ims:
        row.alpha_composite(i, (x, H - i.height)); x += i.width + 20
    out_rows.append(row)
W = max(r.width for r in out_rows); H = sum(r.height for r in out_rows)
out = Image.new("RGBA", (W, H), (235, 232, 245, 255)); y = 0
for r in out_rows: out.alpha_composite(r, (0, y)); y += r.height
out.convert("RGB").save(sys.argv[1]); print(out.size)
