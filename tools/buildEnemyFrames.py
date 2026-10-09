"""Key, slice and foot-register a generated enemy battle sheet into a runtime atlas.

  python3 tools/buildEnemyFrames.py <id> strike <sheet.png> --rows 2 --cols 3 --scale-frame 0
  python3 tools/buildEnemyFrames.py <id> hurt <sheet.png> --rows 1 --cols 4 --scale-frame 3

Texture units match the enemy's idle image, so PixelEnemy keeps one profile scale for every
frame. Feet sit on the cell bottom at the same horizontal offset as in the idle image, so the
anchor (0.5, 1) lines frames up with the idle sprite. See art/characters/enemies/frames/README.md.
"""
import argparse
import json
from pathlib import Path
from PIL import Image
from buildNpcFrames import key, largest_component

root = Path(__file__).resolve().parents[1]
target = root / 'public/assets/characters/enemies'
IDLE = {'disciple': 'disciple.webp', 'zombie': 'zombie-chibi.webp', 'boss': 'boss-chibi.webp'}
RUNTIME_H = 420  # about 2x the battle display height


def figure(im: Image.Image) -> tuple[Image.Image, float]:
    """Crop to the opaque figure; return it with the feet centre x (lowest 12% of the figure)."""
    alpha = im.getchannel('A').point(lambda p: 255 if p > 128 else 0)
    crop = im.crop(alpha.getbbox())
    a = crop.getchannel('A')
    band = int(crop.height * 0.88)
    xs = [x for y in range(band, crop.height) for x in range(crop.width) if a.getpixel((x, y)) > 128]
    return crop, sum(xs) / len(xs)


parser = argparse.ArgumentParser()
parser.add_argument('id', choices=sorted(IDLE))
parser.add_argument('action', choices=['strike', 'hurt'])
parser.add_argument('sheet')
parser.add_argument('--rows', type=int, required=True)
parser.add_argument('--cols', type=int, required=True)
parser.add_argument('--scale-frame', type=int, required=True,
                    help='frame that shows the ready stance; it gets the idle figure height')
args = parser.parse_args()

idle = Image.open(target / IDLE[args.id]).convert('RGBA')
idle_bbox = idle.getchannel('A').point(lambda p: 255 if p > 128 else 0).getbbox()
idle_fig, idle_foot = figure(idle)
foot_offset = idle_bbox[0] + idle_foot - idle.width / 2

sheet = key(Image.open(args.sheet))
cw, ch = sheet.width // args.cols, sheet.height // args.rows
crops = []
for r in range(args.rows):
    for c in range(args.cols):
        cell = largest_component(sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)))
        crops.append(figure(cell))
scale = idle_fig.height / crops[args.scale_frame][0].height
frames = [(im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS), fx * scale)
          for im, fx in crops]

# One cell size for the whole action, in idle-image units; feet at (centre + offset, bottom).
half = max(max(abs(fx + foot_offset), abs(im.width - fx - foot_offset)) for im, fx in frames)
out_w = int(half * 2) + 4
out_h = max(im.height for im, _ in frames) + 2
f = min(1.0, RUNTIME_H / out_h)
sw, sh = round(out_w * f), round(out_h * f)
strip = Image.new('RGBA', (sw * len(frames), sh), (0, 0, 0, 0))
for i, (im, fx) in enumerate(frames):
    cell = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    cell.alpha_composite(im, (round(out_w / 2 + foot_offset - fx), out_h - im.height))
    cell = cell.resize((sw, sh), Image.LANCZOS)
    cell.putalpha(cell.getchannel('A').point(lambda p: 255 if p > 110 else 0))
    strip.alpha_composite(cell, (i * sw, 0))

name = f'{args.id}-{args.action}-v1'
strip.save(target / f'{name}.webp', lossless=True, quality=100, method=6)
(target / f'{name}.json').write_text(json.dumps({'frames': {
    f'enemy:{args.id}:{args.action}:{i}': {
        'frame': dict(x=i * sw, y=0, w=sw, h=sh), 'rotated': False, 'trimmed': False,
        'spriteSourceSize': dict(x=0, y=0, w=sw, h=sh), 'sourceSize': dict(w=sw, h=sh),
    } for i in range(len(frames))
}, 'meta': {'image': f'{name}.webp', 'scale': f'{sh / out_h:.6f}',
            'size': {'w': strip.width, 'h': strip.height}}}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'id': args.id, 'action': args.action, 'frames': len(frames), 'cell': [out_w, out_h],
                  'scale': round(scale, 4), 'foot_offset': round(foot_offset, 1)}))
