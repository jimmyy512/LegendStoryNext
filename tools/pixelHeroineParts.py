"""像素女俠部件前處理。

從 imagegen 原稿裁出部件，依角色實際顯示尺寸縮成 1:1 像素，打包圖集，
並把原稿上量測的關節點換算成縮圖座標，交給 buildPixelHeroine.ts 組骨架。

    python tools/pixelHeroineParts.py

需要 Pillow 與 numpy。遠側（左）肢體沿用右側素材並壓暗，兩側造型因此一致。
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image

import pixelCodexParts
import pixelWardrobe

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/characters/pixelHeroine'
PUBLIC = ROOT / 'public/assets/characters/pixelHeroine'
SHEET = ART / 'source/parts-v1.png'

BODY = 0.21  # 頭、髮、軀幹
LIMB = 0.135  # 手臂、手與靴子
LEG = 0.15  # 褲管略放大，讓腿長接近原稿比例
WEAPON = 0.2
FAR_SHADE = 0.8  # 遠側肢體亮度

# 名稱: (原稿裁切 x0, y0, x1, y1, 縮放, {關節名: 原稿座標})
PARTS = {
    'head': (82, 65, 297, 278, BODY, {'neck': (186, 263), 'bun': (140, 108), 'crown': (201, 108), 'face': (240, 215)}),
    'hair': (653, 26, 898, 313, 0.19, {'root': (866, 76)}),
    'ivory': (
        366, 51, 591, 321, BODY,
        {'neck': (482, 74), 'chest': (485, 122), 'belt': (433, 184), 'beltFront': (518, 189), 'shoulderF': (527, 118), 'shoulderB': (430, 110),
         'hipF': (505, 208), 'hipB': (460, 208), 'waist': (482, 180)},
    ),
    'jade': (
        993, 51, 1218, 321, BODY,
        {'neck': (1109, 74), 'chest': (1112, 122), 'belt': (1060, 184), 'beltFront': (1145, 189), 'shoulderF': (1154, 118), 'shoulderB': (1057, 110),
         'hipF': (1132, 208), 'hipB': (1087, 208), 'waist': (1109, 180)},
    ),
    'upper': (434, 354, 543, 514, LIMB, {'shoulder': (469, 384), 'elbow': (494, 494)}),
    'fore': (1058, 384, 1145, 534, LIMB, {'elbow': (1106, 394), 'wrist': (1105, 526)}),
    'palm': (1058, 524, 1145, 618, LIMB, {'wrist': (1105, 532), 'center': (1101, 572)}),
    'grip': (1061, 1126, 1146, 1188, LIMB, {'wrist': (1107, 1134), 'center': (1105, 1160)}),
    'thigh': (430, 644, 578, 852, LEG, {'hip': (472, 674), 'knee': (532, 838)}),
    'shin': (1045, 679, 1190, 794, LEG, {'knee': (1100, 682), 'ankle': (1097, 784)}),
    'boot': (1045, 769, 1190, 885, LIMB, {'ankle': (1097, 784), 'heel': (1075, 881), 'toe': (1185, 881)}),
    'sword': (118, 907, 207, 1243, WEAPON, {'grip': (163, 1132)}),
    'saber': (447, 907, 546, 1243, WEAPON, {'grip': (472, 1129)}),
}
FAR = ('upper', 'fore', 'palm', 'grip', 'thigh', 'shin', 'boot')


def downsample(crop: Image.Image, scale: float) -> Image.Image:
    size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    rgba = np.asarray(crop, dtype=np.float32) / 255
    alpha = rgba[..., 3:4]
    premul = Image.fromarray(np.uint8(np.concatenate([rgba[..., :3] * alpha, alpha], 2) * 255))
    small = np.asarray(premul.resize(size, Image.BOX), dtype=np.float32) / 255
    a = small[..., 3:4]
    rgb = np.where(a > 0, small[..., :3] / np.maximum(a, 1e-6), 0)
    # 像素美術只留全透明或不透明，避免半透明毛邊。
    solid = a >= 0.5
    out = np.concatenate([np.clip(rgb, 0, 1), solid.astype(np.float32)], 2)
    return Image.fromarray(np.uint8(np.round(out * 255)))


def shade(image: Image.Image, amount: float) -> Image.Image:
    data = np.asarray(image, dtype=np.float32)
    data[..., :3] *= amount
    return Image.fromarray(np.uint8(np.clip(data, 0, 255)))


def main() -> None:
    sheet = Image.open(SHEET).convert('RGBA')
    images: dict[str, Image.Image] = {}
    points: dict[str, dict] = {}
    for name, (x0, y0, x1, y1, scale, joints) in PARTS.items():
        small = downsample(sheet.crop((x0, y0, x1, y1)), scale)
        sx, sy = small.width / (x1 - x0), small.height / (y1 - y0)
        joint = {k: [round((x - x0) * sx, 2), round((y - y0) * sy, 2)] for k, (x, y) in joints.items()}
        variants = {name: small}
        if name in FAR:
            variants = {f'{name}R': small, f'{name}L': shade(small, FAR_SHADE)}
        for key, image in variants.items():
            images[key] = image
            points[key] = {'width': image.width, 'height': image.height, 'points': joint}

    # 換色衣褲靴髮、程式繪製的兵器，與基本部件一起打包。
    pixelWardrobe.build(images, points)
    # Codex 重畫的髮色、衣裝與疊加裝備（斗笠、披風、護肩、胸甲等），同名者覆蓋上面的換色版。
    pixelCodexParts.build(images, points, FAR_SHADE)

    out = ART / 'images'
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('*.png'):
        old.unlink()
    for key, image in images.items():
        image.save(out / f'{key}.png')

    # 高度排序的貨架打包，部件間留 2px 避免取樣滲色。
    pad, width = 2, 256
    x = y = shelf = 0
    placed = {}
    for key in sorted(images, key=lambda k: -images[k].height):
        image = images[key]
        if x + image.width + pad > width:
            x, y, shelf = 0, y + shelf + pad, 0
        placed[key] = (x, y)
        x += image.width + pad
        shelf = max(shelf, image.height)
    height = 1 << (y + shelf).bit_length()
    page = Image.new('RGBA', (width, height))
    for key, (px, py) in placed.items():
        page.paste(images[key], (px, py))
    PUBLIC.mkdir(parents=True, exist_ok=True)
    page.save(PUBLIC / 'pixel-heroine.png')
    lines = [
        'pixel-heroine.png',
        f'size:{width},{height}',
        'filter:Nearest,Nearest',
        'pma:false',
    ]
    for key in sorted(placed):
        px, py = placed[key]
        image = images[key]
        lines += [key, f'bounds:{px},{py},{image.width},{image.height}']
    (PUBLIC / 'pixel-heroine.atlas').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    (ART / 'source/rig-points.json').write_text(
        json.dumps(points, indent=2, ensure_ascii=False) + '\n', encoding='utf-8'
    )
    print(f'{len(images)} parts, atlas {width}x{height}')


if __name__ == '__main__':
    main()
