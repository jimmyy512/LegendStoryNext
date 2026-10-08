"""Reference images for Codex and runtime atlases for generated NPC frame sheets.

  python3 tools/buildNpcFrames.py refs <id>                  # still/gesture refs + layout guide
  python3 tools/buildNpcFrames.py build <id> <action> <sheet.png> [--cols 4]

A sheet is one row of equal columns on flat magenta (see art/characters/npcs/idle/README.md).
Every frame is scaled by one factor that gives frame 0 the height of the atlas still, and is
pasted into an equal cell with the feet centred on the bottom edge, like the atlas stills.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
target = root / 'public/assets/characters/npcs'
art = root / 'art/characters/npcs/idle'
ATLASES = [target / 'ensemble-v2.json', root / 'public/assets/characters/companions/world-v2.json']


def atlas_frame(key: str) -> tuple[Path, dict]:
    for path in ATLASES:
        frames = json.loads(path.read_text(encoding='utf-8'))['frames']
        if key in frames:
            return path.with_suffix('.png'), frames[key]
    raise SystemExit(f'error: {key} not in any NPC atlas')


def crop_frame(key: str) -> Image.Image:
    png, f = atlas_frame(key)
    r = f['frame']
    cell = Image.open(png).convert('RGBA').crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
    # drop soft glow baked around the companion art
    cell.putalpha(cell.getchannel('A').point(lambda p: 255 if p > 128 else 0))
    return cell


def refs(npc: str) -> None:
    out = art / 'refs'
    out.mkdir(parents=True, exist_ok=True)
    for suffix, name in (('', 'still'), (':gesture', 'gesture')):
        cell = crop_frame(f'npc:{npc}{suffix}')
        k = 470 / cell.height
        cell = cell.resize((round(cell.width * k), 470), Image.NEAREST)
        ref = Image.new('RGBA', (max(512, cell.width + 20), 512), (255, 0, 255, 255))
        ref.alpha_composite(cell, ((ref.width - cell.width) // 2, 502 - cell.height))
        ref.convert('RGB').save(out / f'{npc}-{name}.png')
    guide = out / 'guide-4.png'
    if not guide.exists():
        g = Image.new('RGB', (1536, 1024), (255, 0, 255))
        d = ImageDraw.Draw(g)
        for i in range(1, 4):
            d.line([(i * 384, 0), (i * 384, 1024)], fill=(0, 0, 0), width=3)
        d.line([(0, 900), (1536, 900)], fill=(0, 255, 255), width=3)
        g.save(guide)
    print(json.dumps({'id': npc, 'refs': str(out.relative_to(root))}))


def key(im: Image.Image) -> Image.Image:
    """Magenta distance key with despill."""
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            if r > 150 and b > 150 and g < 110 and abs(r - b) < 90:
                px[x, y] = (0, 0, 0, 0)
            elif r > g + 40 and b > g + 40:
                m = min(r, b) - g
                px[x, y] = (r - m // 2, g, b - m // 2, 255)
    return im


def build(npc: str, action: str, sheet_path: str, cols: int) -> None:
    _, still = atlas_frame(f'npc:{npc}')
    figure_h, source_h = still['frame']['h'], still['sourceSize']['h']
    sheet = key(Image.open(sheet_path))
    cell_w = sheet.width // cols
    crops = []
    for c in range(cols):
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

    scale = figure_h / crops[0][0].height
    frames = []
    for crop, foot_x in crops:
        w, h = round(crop.width * scale), round(crop.height * scale)
        frames.append((crop.resize((w, h), Image.LANCZOS), foot_x * scale))
    half = max(max(fx, im.width - fx) for im, fx in frames)
    out_w = int(half * 2) + 4
    out_h = max(source_h, max(im.height for im, _ in frames) + 2)
    strip = Image.new('RGBA', (out_w * len(frames), out_h), (0, 0, 0, 0))
    for i, (im, fx) in enumerate(frames):
        im.putalpha(im.getchannel('A').point(lambda p: 255 if p > 110 else 0))
        strip.alpha_composite(im, (i * out_w + round(out_w / 2 - fx), out_h - im.height))

    name = f'{npc}-{action}-v1'
    strip.save(target / f'{name}.png', optimize=True)
    (target / f'{name}.json').write_text(json.dumps({'frames': {
        f'npc:{npc}:{action}:{i}': {
            'frame': dict(x=i * out_w, y=0, w=out_w, h=out_h), 'rotated': False, 'trimmed': False,
            'spriteSourceSize': dict(x=0, y=0, w=out_w, h=out_h), 'sourceSize': dict(w=out_w, h=out_h),
        } for i in range(len(frames))
    }, 'meta': {'image': f'{name}.png', 'scale': '1', 'size': {'w': strip.width, 'h': strip.height}}},
        indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'id': npc, 'action': action, 'frames': len(frames), 'cell': [out_w, out_h],
                      'scale': round(scale, 4)}))


parser = argparse.ArgumentParser()
sub = parser.add_subparsers(dest='cmd', required=True)
p_refs = sub.add_parser('refs')
p_refs.add_argument('id')
p_build = sub.add_parser('build')
p_build.add_argument('id')
p_build.add_argument('action', choices=['idle', 'gesture'])
p_build.add_argument('sheet')
p_build.add_argument('--cols', type=int, default=4)
args = parser.parse_args()
if args.cmd == 'refs':
    refs(args.id)
else:
    build(args.id, args.action, args.sheet, args.cols)
