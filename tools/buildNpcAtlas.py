"""Metadata only: retain generated pixels, trim frame rectangles with shared foot anchors."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
target = root / 'public/assets/characters/npcs'
im = Image.open(target / 'ensemble-v2.png')
alpha = im.getchannel('A').point(lambda p: 255 if p > 128 else 0)
frames = {}
for c, name in enumerate(['master', 'qing', 'yin', 'fong', 'wo']):
    bounds = []
    for r in range(2):
        cell = (c * 397, r * 430, min((c + 1) * 397, im.width), 430 if r == 0 else im.height)
        box = alpha.crop(cell).getbbox()
        bounds.append((cell[0] + box[0] - 2, cell[1] + box[1] - 2, box[2] - box[0] + 4, box[3] - box[1] + 4))
    left = min(b[0] for b in bounds)
    full_w = max(b[0] + b[2] for b in bounds) - left
    full_h = max(b[3] for b in bounds)
    for r, (x, y, w, h) in enumerate(bounds):
        frames[f'npc:{name}' + (':gesture' if r else '')] = {
            'frame': dict(x=x, y=y, w=w, h=h), 'rotated': False, 'trimmed': True,
            'spriteSourceSize': dict(x=x-left, y=full_h-h, w=w, h=h),
            'sourceSize': dict(w=full_w, h=full_h),
        }
(target / 'ensemble-v2.json').write_text(json.dumps({'frames': frames, 'meta': {
    'image': 'ensemble-v2.png', 'scale': '1', 'size': {'w': im.width, 'h': im.height}
}}, indent=2), encoding='utf-8')
