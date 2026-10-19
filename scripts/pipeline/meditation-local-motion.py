"""Free 2D motion correction for the approved stage-1 meditation still.

Run with Lumio's Python (OpenCV, NumPy, Pillow). No network or generation calls.
Tracks the ORIGINAL stage-4 reference, not the motion-restricted generated v2.
The region coordinates belong to these specific assets, not arbitrary artwork.
Input must be an RGBA cutout made with the owner's Lumio tool.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

REGIONS = {
    "body": (305, 560, 650, 795),
    "left": (125, 637, 285, 735),
    "right": (678, 637, 835, 735),
    "leaves": (200, 110, 760, 435),
}


def track_reference(path):
    cap = cv2.VideoCapture(str(path))
    ok, first = cap.read()
    if not ok or first.shape[:2] != (960, 960):
        raise ValueError("Expected original 960px meditation reference")
    fps = cap.get(cv2.CAP_PROP_FPS)
    gray = cv2.cvtColor(first, cv2.COLOR_BGR2GRAY)
    points = {}
    for name, (x0, y0, x1, y1) in REGIONS.items():
        mask = np.zeros(gray.shape, np.uint8)
        mask[y0:y1, x0:x1] = 255
        points[name] = cv2.goodFeaturesToTrack(gray, 100, .015, 6, mask=mask)
    frames = []
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        current = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        row = {}
        for name, pts in points.items():
            new, valid, _ = cv2.calcOpticalFlowPyrLK(
                gray, current, pts, None, winSize=(31, 31), maxLevel=4)
            back, reverse_valid, _ = cv2.calcOpticalFlowPyrLK(
                current, gray, new, None, winSize=(31, 31), maxLevel=4)
            good = ((valid.ravel() == 1) & (reverse_valid.ravel() == 1)
                    & (np.linalg.norm((back - pts).reshape(-1, 2), axis=1) < 1.5))
            if good.sum() < 6:
                raise ValueError(f"Insufficient {name} tracking evidence")
            transform, _ = cv2.estimateAffinePartial2D(
                pts[good].reshape(-1, 2), new[good].reshape(-1, 2),
                method=cv2.RANSAC, ransacReprojThreshold=2)
            if transform is None:
                raise ValueError(f"Unable to measure {name} motion")
            x0, y0, x1, y1 = REGIONS[name]
            center = np.array([(x0+x1)/2, (y0+y1)/2])
            shift = transform[:, :2] @ center + transform[:, 2] - center
            row[name] = [float(shift[0]), float(shift[1]),
                         float(np.arctan2(transform[1, 0], transform[0, 0]))]
        frames.append(row)
    cap.release()
    return frames, fps


def smooth_periodic(values, output_count):
    # Two harmonics preserve the measured cycle while removing tracking jitter
    # and closing the loop. No duplicated final frame/pause at the seam.
    t = np.linspace(0, 2*np.pi, len(values))
    out_t = np.arange(output_count) * 2*np.pi/output_count
    basis = lambda x: np.column_stack([np.ones_like(x), np.sin(x), np.cos(x),
                                      np.sin(2*x), np.cos(2*x)])
    return basis(out_t) @ np.linalg.lstsq(basis(t), values, rcond=None)[0]


def smoothstep(a, b, x):
    z = np.clip((x-a)/(b-a), 0, 1)
    return z*z*(3-2*z)


def inverse_rigid(x, y, cx, cy, dx, dy, angle):
    # A whole hand rotates rigidly; the blend occurs at the forearm attachment.
    c, s = np.cos(angle), np.sin(angle)
    px, py = x-cx-dx, y-cy-dy
    return c*px+s*py+cx, -s*px+c*py+cy


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--reference", type=Path, default=Path("assets/clips/meditate.mp4"))
    ap.add_argument("--cutout", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--layout", type=Path, help="Verified per-stage attachment alignment")
    args = ap.parse_args()
    if args.output.exists():
        raise ValueError("Use a new output directory; preserve earlier versions")
    tracks, source_fps = track_reference(args.reference)
    fps, count, size = 24, 120, 720
    measured = {name: np.array([r[name] for r in tracks]) for name in REGIONS}
    motion = {"body": smooth_periodic(measured["body"], count)}
    for name in ["left", "right", "leaves"]:
        motion[name] = smooth_periodic(measured[name]-measured["body"], count)
    im = Image.open(args.cutout)
    if im.mode != "RGBA" or im.getchannel("A").getextrema() != (0, 255):
        raise ValueError("Input must contain Lumio transparency")
    rgba = np.asarray(im.resize((size, size), Image.Resampling.LANCZOS)).astype(np.float32)/255
    # Premultiplication prevents invisible background colours creating halos.
    rgba[:, :, :3] *= rgba[:, :, 3:4]
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    # All attachment coordinates below use the approved square still at 540px.
    layout = json.loads(args.layout.read_text()) if args.layout else {}
    alignment = layout.get('scale', 1)
    offset_x, offset_y = layout.get('offset_x', 0), layout.get('offset_y', 0)
    x = (xx*540/size-offset_x)/alignment
    y = (yy*540/size-offset_y)/alignment
    ratio = 265/470  # target pot width / reference pot width, in 540px coordinates
    leaf_ratio = layout.get('foliage_height', 80)/330
    args.output.mkdir(parents=True)
    bounds, rendered_motion = [], []
    for i in range(count):
        body_dx, body_dy = motion["body"][i, :2]*ratio
        bx, by = x-body_dx, y-body_dy
        mx, my = bx.copy(), by.copy()
        record = {"float_y": float(body_dy)}
        band = smoothstep(280, 325, by)*(1-smoothstep(408, 435, by))
        for name, cx, cy, weight in [
            ("left", 110, 367, (1-smoothstep(153, 193, bx))*band),
            ("right", 429, 367, smoothstep(347, 387, bx)*band),
        ]:
            dx, dy, angle = motion[name][i]
            dx, dy = dx*ratio, dy*ratio
            rx, ry = inverse_rigid(bx, by, cx, cy, dx, dy, angle)
            mx += weight*(rx-bx)
            my += weight*(ry-by)
            record[name] = [float(dx), float(dy), float(angle)]
        dx, dy, angle = motion["leaves"][i]
        # Scale translation to this small leaf cluster, retaining measured sway.
        dx, dy = dx*leaf_ratio, dy*leaf_ratio
        weight = 1-smoothstep(208, 225, by)
        if layout.get('overhanging_leaves'):
            sides = np.maximum(1-smoothstep(125, 147, bx), smoothstep(393, 415, bx))
            weight = np.maximum(weight, sides*(1-smoothstep(235, 268, by)))
        rx, ry = inverse_rigid(bx, by, 270, 223, dx, dy, angle)
        mx += weight*(rx-bx)
        my += weight*(ry-by)
        record["leaves"] = [float(dx), float(dy), float(angle)]
        rendered_motion.append(record)
        frame = cv2.remap(rgba, ((mx*alignment+offset_x)*size/540).astype(np.float32),
                          ((my*alignment+offset_y)*size/540).astype(np.float32), cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        frame = np.clip(frame, 0, 1)
        alpha = frame[:, :, 3:4]
        frame[:, :, :3] = np.divide(frame[:, :, :3], alpha,
                                    out=np.zeros_like(frame[:, :, :3]), where=alpha>1e-5)
        out = Image.fromarray((np.clip(frame, 0, 1)*255).round().astype(np.uint8), "RGBA")
        bounds.append(out.getchannel("A").point(lambda v: 255 if v>8 else 0).getbbox())
        out.save(args.output/f"f-{i+1:03d}.png")
    if any(b is None or min(b[:2])<8 or max(b[2:])>size-8 for b in bounds):
        raise ValueError("Unsafe frame margins; inspect outputs before using")
    report = {"method": "Local 2D rigid hand transforms and blended attachment/leaf warps",
              "reference": str(args.reference), "cutout": str(args.cutout),
              "source_fps": source_fps, "fps": fps, "frames": count, "size": size,
              "credits_spent": 0, "layout": layout, "bounds": bounds, "tracks": tracks,
              "rendered_motion": rendered_motion}
    (args.output/"motion-report.json").write_text(json.dumps(report, indent=2)+"\n")
    print(f"Rendered {count} transparent frames at {fps}fps, no credits/network")


if __name__ == "__main__":
    main()
