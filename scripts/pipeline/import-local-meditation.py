"""Import the approved local stage-1 loop, preserving all earlier artwork.

Run from repo root with Lumio's Python. Fixed union crop preserves floating;
pot-rim measurement matches the stage1 idle size. Updates only one manifest key.
"""
import json
import argparse
from pathlib import Path
import numpy as np
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--stage', type=int, default=1, choices=[1,2,3,5,6,7])
parser.add_argument('--source', type=Path)
args = parser.parse_args()
stage = args.stage
source = args.source or Path('mascot-poses/stage-poses/meditation-hula-v1/meditate-stage1-v3-local')
name = f'meditate{stage}'
destination = Path('public/character')/name
if destination.exists():
    raise SystemExit('Destination exists; preserve it and review before replacing')
frames = sorted(source.glob('f-*.png'))
assert len(frames) == 120, 'Expected approved five-second, 24fps loop'
boxes = [Image.open(p).getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox() for p in frames]
x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
width, height = x1-x0, y1-y0
crop = (max(0, round(x0-width*.04)), max(0, round(y0-height*.12)),
        min(720, round(x1+width*.04)), min(720, round(y1+height*.04)))
cw, ch = crop[2]-crop[0], crop[3]-crop[1]
scale = min(340/cw, 400/ch)
target = (round(cw*scale), round(ch*scale))
destination.mkdir(parents=True)
for p in frames:
    im = Image.open(p).crop(crop).resize(target, Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (340, 400))
    canvas.paste(im, ((340-target[0])//2, 400-target[1]))
    canvas.save(destination/p.name)

def rim_width(path):
    a = np.array(Image.open(path).convert('RGBA')).astype(np.int16)
    r, g, b, alpha = [a[...,i] for i in range(4)]
    pot = (alpha>40)&(r>110)&(r>g+10)&(r>b+35)&(b<150)&(g>30)&(g<200)
    rows = pot.sum(axis=1)
    ys = np.where(rows > .5*rows.max())[0]
    start, end = ys.min(), ys.max()
    widths = []
    for y in range(start, int(start+.3*(end-start))+1):
        xs = np.where(pot[y])[0]
        if len(xs)>=20:
            widths.append(int(xs.max()-xs.min()+1))
    return max(widths)

idle_width = rim_width(Path(f'public/character/growth{stage}/f-001.png'))
pose_width = float(np.median([rim_width(p) for p in sorted(destination.glob('f-*.png'))[:5]]))
meta = {'srcW':round(width*1.06*540/720), 'srcH':round(height*1.06*540/720),
        'potScale':round(idle_width/pose_width,4), 'fps':24, 'pingpong':False}
(destination/'meta.json').write_text(json.dumps(meta)+'\n')
manifest_path = Path('src/generated/sprites.ts')
text = manifest_path.read_text()
start = text.index('= ', text.index('export const SPRITES'))+2
manifest = json.loads(text[start:].strip().removesuffix(';'))
assert name not in manifest, 'Do not replace an existing registered variant'
manifest[name] = {'frames':[f'./character/{name}/{p.name}' for p in frames], **meta}
manifest_path.write_text(text[:start]+json.dumps(manifest,indent=2)+';\n')
print(json.dumps({'frames':len(frames), 'crop':crop, 'idle_rim':idle_width,
                  'meditation_rim':pose_width, 'meta':meta}))
