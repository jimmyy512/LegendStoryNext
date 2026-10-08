"""Key, slice and foot-register a generated NPC idle sheet into a runtime atlas.

The sheet is one row of equal columns on flat magenta (see art/characters/npcs/idle/README.md).
Every frame is scaled by one factor taken from frame 0, so the character keeps the height of
its ensemble still, and is pasted into an equal cell with the feet centred on the bottom edge.

usage: python3 tools/buildNpcIdle.py <id> <sheet.png> [--cols 4]
"""
import argparse
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
target = root / 'public/assets/characters/npcs'
parser = argparse.ArgumentParser()
parser.add_argument('id')
parser.add_argument('sheet')
parser.add_argument('--cols', type=int, default=4)
args = parser.parse_args()

ensemble = json.loads((target / 'ensemble-v2.json').read_text(encoding='utf-8'))
still_h = ensemble['frames'][f'npc:{args.id}']['sourceSize']['h']


def key(im: Image.Image) -> Image.Image:
    """Magenta distance key with despill; edge pixels are binarised like the ensemble art."""
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            if r > 150 and b > 150 and g < 110 and abs(r - b) < 90:
                px[x, y] = (0, 0, 0, 0)
            elif r > g + 40 and b > g + 40:
                # magenta fringe: pull red/blue down toward green
                m = min(r, b) - g
                px[x, y] = (r - m // 2, g, b - m // 2, 255)
    return im


sheet = key(Image.open(args.sheet))
cell_w = sheet.width // args.cols
crops = []
for c in range(args.cols):
    cell = sheet.crop((c * cell_w, 0, (c + 1) * cell_w, sheet.height))
    box = cell.getchannel('A').point(lambda p: 255 if p > 128 else 0).getbbox()
    if box is None:
        raise SystemExit(f'error: column {c} is empty')
    crop = cell.crop(box)
    # feet centre: mean x of opaque pixels in the lowest 12% of the figure
    alpha = crop.getchannel('A')
    band = int(crop.height * 0.88)
    xs = [x for y in range(band, crop.height) for x in range(crop.width) if alpha.getpixel((x, y)) > 128]
    crops.append((crop, sum(xs) / len(xs)))

scale = still_h / crops[0][0].height
frames = []
for crop, foot_x in crops:
    w, h = round(crop.width * scale), round(crop.height * scale)
    frames.append((crop.resize((w, h), Image.LANCZOS), foot_x * scale))
half = max(max(fx, im.width - fx) for im, fx in frames)
out_w = int(half * 2) + 4
out_h = max(im.height for im, _ in frames) + 2
strip = Image.new('RGBA', (out_w * len(frames), out_h), (0, 0, 0, 0))
for i, (im, fx) in enumerate(frames):
    a = im.getchannel('A').point(lambda p: 255 if p > 110 else 0)
    im.putalpha(a)
    strip.alpha_composite(im, (i * out_w + round(out_w / 2 - fx), out_h - im.height))

name = f'{args.id}-idle-v1'
strip.save(target / f'{name}.png', optimize=True)
(target / f'{name}.json').write_text(json.dumps({'frames': {
    f'npc:{args.id}:idle:{i}': {
        'frame': dict(x=i * out_w, y=0, w=out_w, h=out_h), 'rotated': False, 'trimmed': False,
        'spriteSourceSize': dict(x=0, y=0, w=out_w, h=out_h), 'sourceSize': dict(w=out_w, h=out_h),
    } for i in range(len(frames))
}, 'meta': {'image': f'{name}.png', 'scale': '1', 'size': {'w': strip.width, 'h': strip.height}}}, indent=2) + '\n',
    encoding='utf-8')
print(json.dumps({'id': args.id, 'frames': len(frames), 'cell': [out_w, out_h], 'scale': round(scale, 4)}))
