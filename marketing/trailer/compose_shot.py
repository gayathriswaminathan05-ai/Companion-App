"""Composite the real app onto the green screens of an AI trailer shot (v2).

"Virtual camera": the AI footage is the room; both screens are re-drawn per
output frame straight from our high-res renders, so they stay pin-sharp even
when the camera pushes all the way into the plant. Green keying keeps arms
and heads that pass in front of a screen in front. The push-in ends framed
on the plant + its bubble, the room going soft; the shot can hold there past
the end of the AI clip because by then the frame is all screen.

  python compose_shot.py <shot.mp4> <out.mp4> --plant marketing/trailer/plant-hi/stretching4 \
      --plant-start 0.8 --bubble-at 0.3 --push 2.2 4.4 --hold 1.6

Run with Lumio's venv python (Pillow, numpy, scipy). ffmpeg from ffmpeg-static.
"""

import argparse
import json
import math
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SCREENS = os.path.join(HERE, "screens")
FF = subprocess.check_output(["node", "-p", "require('ffmpeg-static')"], cwd=ROOT, text=True).strip()


def green_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (g > 100) & (g - r > 55) & (g - b > 30) & (r < 140)


def quad(mask):
    ys, xs = np.nonzero(mask)
    pick = lambda v: (float(xs[v]), float(ys[v]))
    return [pick(np.argmin(xs + ys)), pick(np.argmax(xs - ys)), pick(np.argmax(xs + ys)), pick(np.argmin(xs - ys))]


def poly_mask(q, shape, grow=0):
    im = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([tuple(map(float, p)) for p in q], fill=255)
    m = np.asarray(im) > 0
    return ndimage.binary_dilation(m, iterations=grow) if grow else m


def homography(src_pts, dst_pts):
    """3x3 H with dst ~ H @ src."""
    A, B = [], []
    for (x, y), (u, v) in zip(src_pts, dst_pts):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]
        B += [u, v]
    h = np.linalg.solve(np.array(A, float), np.array(B, float))
    return np.append(h, 1).reshape(3, 3)


def apply(H, x, y):
    v = H @ np.array([x, y, 1.0])
    return v[0] / v[2], v[1] / v[2]


def ease(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def load_plant(path):
    files = sorted(f for f in os.listdir(path) if f.endswith(".png"))
    frames = [Image.open(os.path.join(path, f)).convert("RGBA") for f in files]
    box = None
    for f in frames:
        b = f.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    return [f.crop(box) for f in frames]


class Screen:
    """A screen image (+ optional animated overlays) with a mip pyramid."""

    def __init__(self, base):
        self.levels = [base]
        while self.levels[-1].width > 400:
            im = self.levels[-1]
            self.levels.append(im.resize((im.width // 2, im.height // 2), Image.LANCZOS))

    def pick(self, out_width):
        # smallest level still >= 1.5x the on-screen width
        for i in range(len(self.levels) - 1, -1, -1):
            if self.levels[i].width >= 1.5 * out_width:
                return i
        return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("out")
    ap.add_argument("--plant", default=os.path.join(HERE, "plant-hi", "stretching4"))
    ap.add_argument("--plant-fps", type=float, default=12)
    ap.add_argument("--plant-start", type=float, default=0.8)
    ap.add_argument("--plant-h", type=float, default=0.36, help="plant height as a fraction of screen height")
    ap.add_argument("--bubble", default=os.path.join(SCREENS, "bubble@4x.png"))
    ap.add_argument("--bubble-at", type=float, default=0.3)
    ap.add_argument("--bubble-w", type=float, default=0.24, help="bubble width as a fraction of screen width")
    ap.add_argument("--push", type=float, nargs=2, default=[2.2, 4.4], help="push-in start/end (s); negative = no push")
    ap.add_argument("--hold", type=float, default=1.6, help="extra seconds on the final close-up")
    ap.add_argument("--preroll", type=float, default=0.0, help="seconds on the first frame before the clip plays")
    ap.add_argument("--reverse", action="store_true", help="pull OUT: start close on the plant, end wide")
    ap.add_argument("--plant-loop", action="store_true", help="loop the plant animation instead of holding its last frame")
    ap.add_argument("--pad", type=float, default=0.10)
    ap.add_argument("--blur", type=float, default=7.0, help="room blur (px) once focused on the plant")
    ap.add_argument("--size", type=int, nargs=2, default=[1920, 1080])
    args = ap.parse_args()
    OW, OH = args.size

    probe = subprocess.run([FF, "-i", args.video], capture_output=True, text=True).stderr
    fps = 24.0
    for tok in probe.split(","):
        if tok.strip().endswith(" fps"):
            fps = float(tok.strip().split()[0])

    mon = Screen(Image.open(os.path.join(SCREENS, "monitor-bare@4x.png")).convert("RGB"))
    lap = Screen(Image.open(os.path.join(SCREENS, "laptop@4x.png")).convert("RGB"))
    SW, SH = mon.levels[0].size
    no_bubble = args.bubble == "none"
    no_plant = args.plant == "none"
    bub_full = Image.open(os.path.join(SCREENS, "bubble@4x.png") if no_bubble else args.bubble).convert("RGBA")
    bub_full = bub_full.crop(bub_full.getchannel("A").getbbox())
    bw = args.bubble_w * SW
    bub_full = bub_full.resize((round(bw), round(bw * bub_full.height / bub_full.width)), Image.LANCZOS)
    plant = load_plant(os.path.join(HERE, "plant-hi", "stretching4") if no_plant else args.plant)
    ph = args.plant_h * SH
    pw = ph * plant[0].width / plant[0].height
    plant = [p.resize((round(pw), round(ph)), Image.LANCZOS) for p in plant]
    px, py = SW - 0.02 * SW - pw, SH - 0.075 * SH - ph          # bottom-right, above the dock
    bx, by = px - bub_full.width * 0.78, py + ph * 0.05          # bubble up-left of the plant

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([FF, "-loglevel", "error", "-i", args.video, os.path.join(tmp, "in-%04d.png")], check=True)
        src_frames = sorted(f for f in os.listdir(tmp) if f.startswith("in-"))
        first = np.asarray(Image.open(os.path.join(tmp, src_frames[0])).convert("RGB")).astype(int)
        FWd, FHd = first.shape[1], first.shape[0]

        # Screens = green seen in ANY frame (the person moves, so every part of
        # each screen shows up green at some point), not just frame 1.
        m0 = np.zeros(first.shape[:2], bool)
        for fn in src_frames[:: max(1, len(src_frames) // 24)]:
            m0 |= green_mask(np.asarray(Image.open(os.path.join(tmp, fn)).convert("RGB")).astype(int))
        m0 = ndimage.binary_opening(m0, iterations=1)
        lab, n = ndimage.label(m0)
        sizes = ndimage.sum(m0, lab, range(1, n + 1))
        order = np.argsort(sizes)[::-1][:2]
        regs = [ndimage.binary_fill_holes(lab == k + 1) for k in order]
        mon_q, lap_q = quad(regs[0]), quad(regs[1])
        # regions = the true screen outlines (incl. any corner a sticky note hides)
        mon_reg, lap_reg = poly_mask(mon_q, first.shape[:2]), poly_mask(lap_q, first.shape[:2])
        corners = lambda W, H: [(0, 0), (W, 0), (W, H), (0, H)]
        H_mon = homography(corners(SW, SH), mon_q)          # screen -> frame
        H_lap = homography(corners(*lap.levels[0].size), lap_q)
        zone = ndimage.binary_dilation(mon_reg | lap_reg, iterations=12)
        screen_area = ndimage.binary_dilation(mon_reg | lap_reg, iterations=2)
        # Room layer gets a low-res copy of the screens in place of the green
        # before any blur, so the focus blur can't smear green onto the bezels.
        fill = Image.new("RGB", (FWd, FHd))
        for scr, Hs in [(mon, H_mon), (lap, H_lap)]:
            small = scr.levels[min(2, len(scr.levels) - 1)]
            Hf = np.linalg.inv(Hs @ np.diag([scr.levels[0].width / small.width] * 2 + [1]))
            Hf = Hf / Hf[2, 2]
            w = small.transform((FWd, FHd), Image.PERSPECTIVE, tuple(Hf.flatten()[:8]), Image.BILINEAR)
            m = Image.fromarray((ndimage.binary_dilation(mon_reg if scr is mon else lap_reg, iterations=3) * 255).astype(np.uint8))
            fill = Image.composite(w, fill, m)

        # Final framing: plant + bubble, padded, mapped into the frame, 16:9.
        tx0, ty0 = min(px, bx), min(py, by)
        tx1, ty1 = px + pw, max(py + ph, by + bub_full.height)
        pts = [apply(H_mon, x, y) for x, y in [(tx0, ty0), (tx1, ty0), (tx1, ty1), (tx0, ty1)]]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        cx1, cy1 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        w1 = max(max(xs) - min(xs), (max(ys) - min(ys)) * OW / OH) * (1 + 2 * args.pad)
        w0, cx0, cy0 = float(FWd), FWd / 2, FHd / 2

        n_out = round(args.preroll * fps) + len(src_frames) + round(args.hold * fps)
        last_mask = None
        for i in range(n_out):
            t = i / fps
            si = min(max(0, i - round(args.preroll * fps)), len(src_frames) - 1)
            fr = Image.open(os.path.join(tmp, src_frames[si])).convert("RGB")
            a = np.asarray(fr).astype(int)
            g = ndimage.binary_closing(green_mask(a) & zone, iterations=1)
            # de-spill hair/arm edges next to the screens
            ring = ndimage.binary_dilation(g, iterations=4) & ~g
            lim = np.maximum(a[..., 0], a[..., 2])
            a[..., 1] = np.where(ring & (a[..., 1] > lim), lim, a[..., 1])
            fr = Image.fromarray(a.clip(0, 255).astype(np.uint8))

            # camera: log-zoom from the full frame to the plant close-up
            e = 0.0 if args.push[0] < 0 else ease((t - args.push[0]) / (args.push[1] - args.push[0]))
            if args.reverse and args.push[0] >= 0:
                e = 1.0 - e
            cw = math.exp(math.log(w0) + (math.log(w1) - math.log(w0)) * e)
            ch = cw * OH / OW
            cx = cx0 + (cx1 - cx0) * e
            cy = cy0 + (cy1 - cy0) * e
            x0 = min(max(0.0, cx - cw / 2), FWd - cw)
            y0 = min(max(0.0, cy - ch / 2), FHd - ch)
            sc = OW / cw
            F2O = np.array([[sc, 0, -x0 * sc], [0, sc, -y0 * sc], [0, 0, 1]])  # frame -> output

            box = (round(x0), round(y0), round(x0 + cw), round(y0 + ch))
            soft_green = ((a[..., 1] - np.maximum(a[..., 0], a[..., 2])) > 25) & (a[..., 1] > 70)
            # Any chroma green left just outside a screen outline (bezel rim)
            # becomes dark like the bezel: blur + zoom would turn it into a stripe.
            gz = (soft_green & screen_area) | (green_mask(a) & zone)
            gfill = Image.fromarray((ndimage.binary_dilation(gz, iterations=1) * 255).astype(np.uint8))
            room = Image.composite(fill, fr, gfill).crop(box).resize((OW, OH), Image.LANCZOS)
            if e > 0:
                room = room.filter(ImageFilter.GaussianBlur(args.blur * e))
            # Occluders = solid non-green things inside a screen (arms, head).
            # Opening drops thin rims of half-green edge pixels, so the screen
            # covers its own fringe instead of showing a green line up close.
            occ = ndimage.binary_opening(screen_area & ~soft_green, iterations=2)
            occ_a = np.asarray(Image.fromarray((occ * 255).astype(np.uint8)).crop(box).resize((OW, OH), Image.BILINEAR)
                               .filter(ImageFilter.GaussianBlur(0.6 * max(1.0, sc / 2)))).astype(np.float64) / 255

            out = room
            for scr, Hs, reg, animated in [(mon, H_mon, mon_reg, True), (lap, H_lap, lap_reg, False)]:
                q = [tuple(F2O @ np.array([*apply(Hs, *c), 1.0]))[:2] for c in corners(*scr.levels[0].size)]
                ow = max(abs(q[1][0] - q[0][0]), abs(q[2][0] - q[3][0]))
                lv = scr.pick(ow)
                img = scr.levels[lv]
                f = img.width / scr.levels[0].width
                if animated:
                    img = img.copy()
                    k = int((t - args.plant_start) * args.plant_fps)
                    pi = 0 if t < args.plant_start else (k % len(plant) if args.plant_loop else min(len(plant) - 1, k))
                    p = plant[pi] if f == 1 else plant[pi].resize((max(1, round(pw * f)), max(1, round(ph * f))), Image.LANCZOS)
                    if not no_plant:
                        img.paste(p, (round(px * f), round(py * f)), p)
                    if not no_bubble and t >= args.bubble_at:
                        k = ease((t - args.bubble_at) / 0.25)
                        s = (0.85 + 0.15 * k) * f
                        b = bub_full.resize((max(1, round(bub_full.width * s)), max(1, round(bub_full.height * s))), Image.LANCZOS)
                        b.putalpha(b.getchannel("A").point(lambda v: round(v * k)))
                        cxb, cyb = (bx + bub_full.width / 2) * f, (by + bub_full.height / 2) * f
                        img.paste(b, (round(cxb - b.width / 2), round(cyb - b.height / 2)), b)
                # output -> level-image coefficients for PIL
                Hc = np.linalg.inv(F2O @ Hs @ np.diag([1 / f, 1 / f, 1]))
                Hc = Hc / Hc[2, 2]
                warped = img.transform((OW, OH), Image.PERSPECTIVE, tuple(Hc.flatten()[:8]), Image.BICUBIC)
                # exact screen outline (grown ~1.5 source px over the fringe), anti-aliased
                ccx, ccy = sum(p[0] for p in q) / 4, sum(p[1] for p in q) / 4
                grow = 2.5 * sc
                qq = []
                for x, y in q:
                    d = math.hypot(x - ccx, y - ccy) or 1
                    qq.append(((x + (x - ccx) / d * grow) * 2, (y + (y - ccy) / d * grow) * 2))
                poly = Image.new("L", (OW * 2, OH * 2), 0)
                ImageDraw.Draw(poly).polygon(qq, fill=255)
                poly = np.asarray(poly.resize((OW, OH), Image.LANCZOS)).astype(np.float64) / 255
                alpha = Image.fromarray((poly * (1 - occ_a) * 255).clip(0, 255).astype(np.uint8))
                out = Image.composite(warped, out, alpha)
            out.save(os.path.join(tmp, f"out-{i + 1:04d}.png"))

        subprocess.run([FF, "-loglevel", "error", "-y", "-framerate", f"{fps}", "-i", os.path.join(tmp, "out-%04d.png"),
                        "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", args.out], check=True)
    print(json.dumps({"out": args.out, "frames": n_out, "fps": fps}))


if __name__ == "__main__":
    main()
