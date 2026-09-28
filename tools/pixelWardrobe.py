"""像素女俠衣櫃：由基本部件換色衍生變體，並以程式繪製小型兵器。

pixelHeroineParts.py 會呼叫 build()，把變體與基本部件一起打包。
換色依材質遮罩（HLS）挑像素，再依原本明暗對應到新色階，保留像素陰影。
"""

import colorsys

import numpy as np
from PIL import Image


def hls(image: Image.Image) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    data = np.asarray(image.convert('RGBA'), dtype=np.float32) / 255
    rgb = data[..., :3].reshape(-1, 3)
    out = np.array([colorsys.rgb_to_hls(*c) for c in rgb]).reshape(*data.shape[:2], 3)
    return out[..., 0], out[..., 1], out[..., 2], data[..., 3] > 0


def hexrgb(value: str) -> np.ndarray:
    return np.array([int(value[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)


def remap(image: Image.Image, mask: np.ndarray, ramp: list[str]) -> Image.Image:
    """遮罩內的像素依相對亮度套到 ramp（暗→亮）。"""
    if not mask.any():
        return image
    data = np.asarray(image.convert('RGBA'), dtype=np.float32).copy()
    light = data[..., :3].mean(2)
    lo, hi = np.percentile(light[mask], 3), np.percentile(light[mask], 97)
    t = np.clip((light - lo) / max(hi - lo, 1), 0, 1)
    stops = np.array([hexrgb(c) for c in ramp])
    pos = t * (len(stops) - 1)
    index = np.minimum(pos.astype(int), len(stops) - 2)
    frac = (pos - index)[..., None]
    color = stops[index] * (1 - frac) + stops[index + 1] * frac
    data[..., :3] = np.where(mask[..., None], color, data[..., :3])
    return Image.fromarray(np.uint8(np.clip(np.round(data), 0, 255)))


# 材質遮罩：輪廓線（很暗）一律保留。
def cloth_dark(image):
    h, l, s, a = hls(image)
    return a & (l >= 0.12) & (s < 0.22)


def red(image):
    h, l, s, a = hls(image)
    return a & (l >= 0.15) & (s >= 0.45) & ((h < 0.045) | (h > 0.95))


def leather(image):
    h, l, s, a = hls(image)
    return a & (l >= 0.1) & (l < 0.5) & (h >= 0.02) & (h < 0.12) & (s >= 0.12) & ~red(image)


def gold(image):
    h, l, s, a = hls(image)
    return a & (h >= 0.09) & (h < 0.18) & (s >= 0.45) & (l >= 0.35)


def white_cloth(image, skin_rows=0):
    """米白布料：高亮度的暖色。skin_rows 以上是脖子皮膚，不換色。"""
    h, l, s, a = hls(image)
    mask = a & (l >= 0.6) & (h >= 0.05) & (h < 0.13)
    mask[:skin_rows] = False
    return mask


def teal(image):
    h, l, s, a = hls(image)
    return a & (h >= 0.4) & (h < 0.62) & (l >= 0.12)


PANTS = {
    'ink': None,
    'moon': (['#5d6470', '#9aa3ad', '#d6dbe0'], '#2f6f8f'),
    'indigo': (['#1c2447', '#34457c', '#5873b0'], '#d8b34a'),
    'umber': (['#3b2618', '#6b4a2e', '#9a7348'], '#2e5d3a'),
}
BOOTS = {
    'brown': None,
    'black': (['#16161c', '#2b2b35', '#4a4a58'], ['#8a8f99', '#c8ccd4']),
    'white': (['#8d8a86', '#c9c5bd', '#f0ece2'], ['#3f6e8c', '#6fa3c4']),
    'red': (['#4a1012', '#8e2024', '#c9423e'], ['#d6b04c', '#f3dc86']),
}
OUTFITS = {
    # 名稱: (白布色階, 青襟色階)
    'ivory': None,
    'jade': (None, ['#0f2a22', '#1f4d3c', '#3f7a5d']),
    'night': (['#17171d', '#2c2c36', '#4a4a57'], ['#3d0f14', '#7a1c24', '#b33a3e']),
}


def recolor_pants(image, key):
    spec = PANTS[key]
    if not spec:
        return image
    ramp, wrap = spec
    out = remap(image, cloth_dark(image), ramp)
    return remap(out, red(image), [shade(wrap, 0.45), wrap, shade(wrap, 1.35)])


def recolor_boots(image, key):
    spec = BOOTS[key]
    if not spec:
        return image
    ramp, trim = spec
    out = remap(image, leather(image), ramp)
    return remap(out, gold(image), trim)


def recolor_outfit(image, key, skin_rows=0):
    spec = OUTFITS[key]
    if not spec:
        return image
    whites, trim = spec
    out = image
    if whites:
        out = remap(out, white_cloth(image, skin_rows), whites)
    if trim:
        out = remap(out, teal(image), trim)
    return out


def shade(value: str, amount: float) -> str:
    rgb = np.clip(hexrgb(value) * amount, 0, 255).astype(int)
    return '#' + ''.join(f'{v:02x}' for v in rgb)


# ---- 程式繪製的兵器（1:1 像素，刃尖朝上）----

INK = (26, 18, 16, 255)


def canvas(w: int, h: int) -> np.ndarray:
    return np.zeros((h, w, 4), dtype=np.uint8)


def put(img, x, y, color):
    if 0 <= y < img.shape[0] and 0 <= x < img.shape[1]:
        img[y, x] = (*color, 255) if len(color) == 3 else color


def outline(img: np.ndarray) -> np.ndarray:
    """在不透明像素外圍描一圈深色輪廓。"""
    solid = img[..., 3] > 0
    grown = solid.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        grown |= np.roll(solid, (dy, dx), (0, 1))
    out = img.copy()
    out[grown & ~solid] = INK
    return out


def rect(img, x0, y0, x1, y1, color):
    for y in range(y0, y1):
        for x in range(x0, x1):
            put(img, x, y, color)


def spear() -> tuple[Image.Image, dict]:
    w, h = 11, 100
    img = canvas(w, h)
    cx = 5
    wood, wood_hi, wood_dk = (120, 74, 40), (168, 112, 62), (78, 46, 26)
    steel = [(88, 102, 116), (170, 186, 198), (236, 242, 246)]
    # 槍桿
    for y in range(22, h - 3):
        put(img, cx - 1, y, wood_dk)
        put(img, cx, y, wood if y % 7 else wood_dk)
        put(img, cx + 1, y, wood_hi)
    rect(img, cx - 1, h - 3, cx + 2, h - 1, (190, 150, 70))  # 槍纂
    # 槍頭（柳葉形）
    for y in range(2, 20):
        half = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1][y - 2]
        for x in range(cx - half, cx + half + 1):
            tone = 2 if x < cx else 1 if x == cx else 0
            put(img, x, y, steel[tone])
    rect(img, cx - 2, 20, cx + 3, 22, (190, 150, 70))  # 吞口
    # 紅纓
    reds = [(142, 20, 24), (200, 40, 44), (232, 86, 70)]
    for i, y in enumerate(range(22, 32)):
        spread = min(4, 1 + i // 2)
        for x in range(cx - spread, cx + spread + 1):
            if (x + y) % 3:
                put(img, x, y, reds[(x + i) % 3])
    return Image.fromarray(outline(img)), {'grip': [cx, 84], 'grip2': [cx, 46], 'tip': [cx, 2]}


def fan(opened: bool) -> tuple[Image.Image, dict]:
    bamboo, bamboo_dk = (196, 160, 96), (130, 98, 52)
    if not opened:
        w, h = 7, 26
        img = canvas(w, h)
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                put(img, x, y, bamboo if (x + y // 3) % 2 else bamboo_dk)
        rect(img, 2, h - 4, w - 2, h - 2, (170, 40, 40))
        return Image.fromarray(outline(img)), {'grip': [3, h - 6]}
    r = 18
    w, h = 2 * r + 3, r + 6
    img = canvas(w, h)
    cx, cy = r + 1, r + 2
    paper = [(222, 214, 190), (244, 238, 220)]
    for y in range(h):
        for x in range(w):
            dx, dy = x - cx, cy - y
            d = (dx * dx + dy * dy) ** 0.5
            if dy >= 0 and 6 <= d <= r and dy >= -0.2 * abs(dx):
                ang = np.degrees(np.arctan2(dy, dx))
                rib = int(ang) % 15 < 2
                ink = 11 <= d <= 14 and 40 < ang < 120 and (x * 3 + y) % 5 == 0
                put(img, x, y, bamboo_dk if rib else (60, 70, 80) if ink else paper[int(ang // 15) % 2])
            elif dy >= -1 and d < 6:
                put(img, x, y, bamboo)
    return Image.fromarray(outline(img)), {'grip': [cx, cy]}


def dart() -> tuple[Image.Image, dict]:
    w, h = 7, 20
    img = canvas(w, h)
    steel = [(96, 110, 124), (178, 192, 204), (240, 244, 248)]
    for y in range(1, 11):
        half = [0, 1, 1, 1, 2, 2, 1, 1, 1, 0][y - 1]
        for x in range(3 - half, 4 + half):
            put(img, x, y, steel[2 if x < 3 else 1 if x == 3 else 0])
    rect(img, 2, 11, 5, 13, (60, 60, 68))
    for y in range(13, 19):
        for x in range(1, 6):
            if (x + y) % 2:
                put(img, x, y, (200, 40, 44))
    return Image.fromarray(outline(img)), {'grip': [3, 12]}


def knuckle(fist: Image.Image) -> Image.Image:
    """握拳手套：拳面加一排黃銅指虎，手背壓成皮革色。"""
    data = np.asarray(fist.convert('RGBA')).copy()
    h, l, s, a = hls(fist)
    skin = a & (l > 0.5) & (h < 0.12)
    data[skin, :3] = (np.array([120, 78, 44]) * (0.7 + 0.5 * l[skin][:, None])).clip(0, 255)
    rows = np.where(a.any(1))[0]
    for y in rows[-4:-1]:
        cols = np.where(a[y])[0]
        for x in cols[1:-1]:
            data[y, x, :3] = (214, 176, 70) if (x + y) % 2 else (150, 112, 40)
    return Image.fromarray(data)


def build(images: dict, points: dict) -> None:
    """把衍生變體加入 images／points（就地修改）。"""

    def add(key, image, joints):
        images[key] = image
        points[key] = {'width': image.width, 'height': image.height, 'points': joints}

    base = {k: (images[k], points[k]['points']) for k in list(images)}
    for key in PANTS:
        if key == 'ink':
            continue
        for part in ('thighR', 'thighL', 'shinR', 'shinL'):
            add(f'{part}_{key}', recolor_pants(base[part][0], key), base[part][1])
    for key in BOOTS:
        if key == 'brown':
            continue
        for part in ('bootR', 'bootL'):
            add(f'{part}_{key}', recolor_boots(base[part][0], key), base[part][1])
    for key in OUTFITS:
        if key == 'ivory':
            continue
        for part in ('upperR', 'upperL', 'foreR', 'foreL'):
            add(f'{part}_{key}', recolor_outfit(base[part][0], key), base[part][1])
    neck = int(base['ivory'][1]['neck'][1]) + 4
    add('night', recolor_outfit(base['ivory'][0], 'night', neck), base['ivory'][1])
    for side in 'RL':
        fist, joints = base[f'grip{side}']
        add(f'knuckle{side}', knuckle(fist), joints)
    for key, (image, joints) in {
        'spear': spear(),
        'fan': fan(False),
        'fanOpen': fan(True),
        'dart': dart(),
    }.items():
        add(key, image, joints)
