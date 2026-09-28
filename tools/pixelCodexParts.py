"""把 Codex 產的部件表（洋紅底）切成 1:1 像素部件，由 pixelHeroineParts.py 的 build() 呼叫。

    python tools/pixelCodexParts.py   # 列出各表偵測到的部件，輸出編號預覽圖 pieces.png

部件依重心由上而下、由左而右編號；切圖時去掉洋紅底與洋紅毛邊。
替換型部件（頭、馬尾、軀幹、袖子）縮到原部件的外框大小，關節點照比例換算，骨架不必改。
疊加裝備依指定寬度縮圖，掛點以外框比例標定。
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
CODEX = ROOT / 'art/characters/pixelHeroine/source/codex'


def key_out(image: Image.Image) -> Image.Image:
    """洋紅底轉透明，連帶去掉邊緣偏洋紅的混色像素與幾乎透明的雜點。

    Codex 的原始產出是透明底（存成 out.png 時才常被墊上洋紅），兩種都處理。
    """
    data = np.asarray(image.convert('RGBA')).astype(np.int32).copy()
    r, g, b = data[..., 0], data[..., 1], data[..., 2]
    magenta = (r > 150) & (b > 150) & (g < 110) & (np.abs(r - b) < 90)
    fringe = ((r + b) / 2 - g > 95) & (np.minimum(r, b) > 110)
    data[magenta | fringe | (data[..., 3] < 128), 3] = 0
    return Image.fromarray(data.astype(np.uint8))


def pieces(sheet: str, gap: int = 6) -> list[tuple[int, int, int, int]]:
    """回傳各部件外框 (x0, y0, x1, y1)。相距 gap 內的碎塊（流蘇、繩子）併在一起，太小的雜點略過。"""
    image = key_out(Image.open(CODEX / sheet / 'out.png'))
    min_area = image.width * image.height * 0.002
    solid = np.asarray(image)[..., 3] > 0
    grown = ndimage.binary_dilation(solid, iterations=gap)
    labels, count = ndimage.label(grown)
    boxes = []
    for index, found in enumerate(ndimage.find_objects(labels), 1):
        ys, xs = found
        area = (labels[found] == index).sum()
        if area < min_area:
            continue
        inner = solid[found] & (labels[found] == index)
        rows, cols = np.where(inner.any(1))[0], np.where(inner.any(0))[0]
        boxes.append((xs.start + cols[0], ys.start + rows[0], xs.start + cols[-1] + 1, ys.start + rows[-1] + 1))
    # 依列分組：重心 y 相差不到最小高度一半視為同一列。
    boxes.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows_out, current = [], []
    for box in boxes:
        if current and (box[1] + box[3]) / 2 - (current[0][1] + current[0][3]) / 2 > min(b[3] - b[1] for b in current) / 2:
            rows_out.append(sorted(current))
            current = []
        current.append(box)
    rows_out.append(sorted(current))
    return [box for row in rows_out for box in row]


def crop(sheet: str, box: tuple[int, int, int, int]) -> Image.Image:
    return key_out(Image.open(CODEX / sheet / 'out.png')).crop(box)


SHEET = ROOT / 'art/characters/pixelHeroine/source/parts-v1.png'


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """預乘 alpha 後以 BOX 縮到 size，alpha 只留全透明或不透明。"""
    rgba = np.asarray(image, dtype=np.float32) / 255
    alpha = rgba[..., 3:4]
    premul = Image.fromarray(np.uint8(np.round(np.concatenate([rgba[..., :3] * alpha, alpha], 2) * 255)))
    small = np.asarray(premul.resize(size, Image.BOX), dtype=np.float32) / 255
    a = small[..., 3:4]
    rgb = np.where(a > 0, small[..., :3] / np.maximum(a, 1e-6), 0)
    out = np.concatenate([np.clip(rgb, 0, 1), (a >= 0.5).astype(np.float32)], 2)
    return Image.fromarray(np.uint8(np.round(out * 255)))


def tight(image: Image.Image) -> tuple[int, int, int, int]:
    return Image.fromarray(np.uint8(np.asarray(image)[..., 3] > 0) * 255).getbbox()


def replace_like(new: Image.Image, crop_box, joints: dict, scale: float) -> tuple[Image.Image, dict]:
    """把 new 縮成原部件（原稿 crop_box 內的實際外框）的最終大小，關節點照外框比例換算。"""
    old = Image.open(SHEET).convert('RGBA').crop(crop_box)
    x0, y0, x1, y1 = tight(old)
    size = (max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale)))
    image = fit(new, size)
    sx, sy = size[0] / (x1 - x0), size[1] / (y1 - y0)
    cx, cy = crop_box[0] + x0, crop_box[1] + y0
    return image, {k: [round((x - cx) * sx, 2), round((y - cy) * sy, 2)] for k, (x, y) in joints.items()}


def gear(new: Image.Image, width: int, joints: dict, height: int | None = None) -> tuple[Image.Image, dict]:
    """依寬度等比縮圖；joints 為外框比例 (0~1)。"""
    size = (width, height or max(1, round(new.height * width / new.width)))
    image = fit(new, size)
    return image, {k: [round(fx * size[0], 2), round(fy * size[1], 2)] for k, (fx, fy) in joints.items()}


def above_palm(image: Image.Image) -> Image.Image:
    """前臂袖子去掉手掌：由下往上找到最後一列以膚色為主的列，從那裡切掉。"""
    data = np.asarray(image, dtype=np.int32)
    r, g, b, a = (data[..., i] for i in range(4))
    skin = (a > 0) & (r > 200) & (g > 140) & (b > 100) & (r - b > 40)
    solid = (a > 0).sum(1)
    rows = np.where((skin.sum(1) > 0.4 * np.maximum(solid, 1)) & (solid > 0))[0]
    top = rows[rows > image.height * 0.5].min()
    return image.crop((0, 0, image.width, int(top) + 2))


def shade(image: Image.Image, amount: float) -> Image.Image:
    data = np.asarray(image, dtype=np.float32).copy()
    data[..., :3] *= amount
    return Image.fromarray(np.uint8(np.clip(data, 0, 255)))


# 原部件在 parts-v1.png 的裁切框與關節點（與 pixelHeroineParts.PARTS 相同）。
def original(name: str):
    import pixelHeroineParts

    x0, y0, x1, y1, scale, joints = pixelHeroineParts.PARTS[name]
    return (x0, y0, x1, y1), joints, scale


def worn_on_head(sheet: str, head: Image.Image, neck: tuple[float, float]) -> tuple[Image.Image, dict]:
    """帽子表左邊是帽子、右邊是戴在原頭上的樣子。由右邊量出頭的大小與位置，
    把帽子縮到和角色的頭同比例，並算出頭的 neck 點落在帽子的哪裡，套上去就和示意圖一樣貼合。"""
    hat_box, worn_box = pieces(sheet)[:2]
    worn = np.asarray(crop(sheet, worn_box))[..., 3] > 0
    below = worn[hat_box[3] - hat_box[1] + 2 - (worn_box[1] - hat_box[1]) :]
    offset = worn.shape[0] - below.shape[0]
    rows, cols = np.where(below.any(1))[0], np.where(below.any(0))[0]
    # 頭的左右與下緣（帽簷以下露出的部分），對應角色頭部件的實際外框。
    hx0, hx1, hy1 = cols[0], cols[-1] + 1, offset + rows[-1] + 1
    x0, y0, x1, y1 = tight(head)
    k = (x1 - x0) / (hx1 - hx0)
    neck_x = worn_box[0] + hx0 + (neck[0] - x0) / k
    neck_y = worn_box[1] + hy1 - (y1 - neck[1]) / k
    hat = crop(sheet, hat_box)
    size = (round(hat.width * k), round(hat.height * k))
    # 右邊的帽子和左邊同大同高，neck 相對右邊帽子的位置就是相對左邊帽子的位置。
    right_hat_x0 = worn_box[0]
    joint = [round((neck_x - right_hat_x0) * k, 2), round((neck_y - hat_box[1]) * k, 2)]
    return fit(hat, size), {'neck': joint}


HAIR_COLORS = ['black', 'silver', 'auburn', 'chestnut']
# 新衣裝：(軀幹編號, 上臂編號, 前臂編號)。紫蘭夜袍借用白金儒衫的白袖當內衫。
OUTFITS = {
    'robe': (0, 4, 8),
    'scholar': (1, 6, 10),
    'orchid': (2, 6, 10),
    'hunter': (3, 7, 11),
}


def build(images: dict, points: dict, far_shade: float) -> None:
    """Codex 部件加入 images／points（就地修改，同名者覆蓋程式繪製版）。"""

    def add(key, made):
        image, joints = made
        images[key] = image
        points[key] = {'width': image.width, 'height': image.height, 'points': joints}

    # 髮色：頭與馬尾整組重畫，臉不再被換色波及。
    heads, tails = pieces('hair-colors')[:4], pieces('hair-colors')[4:]
    for color, head_box, tail_box in zip(HAIR_COLORS, heads, tails):
        box, joints, scale = original('head')
        add(f'head_{color}', replace_like(crop('hair-colors', head_box), box, joints, scale))
        box, joints, scale = original('hair')
        add(f'hair_{color}', replace_like(crop('hair-colors', tail_box), box, joints, scale))

    # 衣裝：軀幹與兩段袖子。
    boxes = pieces('outfit-robe')
    for key, (torso, upper, fore) in OUTFITS.items():
        box, joints, scale = original('ivory')
        add(key, replace_like(crop('outfit-robe', boxes[torso]), box, joints, scale))
        sleeves = {
            'upper': crop('outfit-robe', boxes[upper]),
            'fore': above_palm(crop('outfit-robe', boxes[fore])),
        }
        for part, image in sleeves.items():
            box, joints, scale = original(part)
            made, j = replace_like(image, box, joints, scale)
            add(f'{part}R_{key}', (made, j))
            add(f'{part}L_{key}', (shade(made, far_shade), j))

    # 疊加裝備。
    armor = pieces('gear-armor')
    hem = pieces('gear-hem')
    add('lamellar', gear(crop('gear-armor', armor[0]), 31, {'waist': (0.5, 0.63)}))
    for index, kind in ((1, 'Iron'), (2, 'Hide')):
        made, j = gear(crop('gear-armor', armor[index]), 15, {'shoulder': (0.45, 0.14)})
        add(f'pauldron{kind}R', (made, j))
        add(f'pauldron{kind}L', (shade(made, far_shade), j))
    add('capeCrimson', gear(crop('gear-armor', armor[3]), 54, {'top': (0.9, 0.07)}))
    add('capeMidnight', gear(crop('gear-armor', armor[4]), 54, {'top': (0.9, 0.07)}))
    add('hatCrown', gear(crop('gear-armor', armor[5]), 22, {'seat': (0.45, 0.9)}))
    # 斗笠另外平視重畫（第一版是仰角看得到帽底和繫繩），依戴在頭上的示意圖對齊。
    add('hatStraw', worn_on_head('hat-straw', images['head'], tuple(points['head']['points']['neck'])))
    add('gourd', gear(crop('gear-armor', armor[7]), 10, {'hook': (0.45, 0.04)}))
    add('pendant', gear(crop('gear-armor', armor[8]), 8, {'hook': (0.5, 0.03)}))
    add('hemTeal', gear(crop('gear-hem', hem[0]), 46, {'top': (0.53, 0.08)}))
    add('hemCrimson', gear(crop('gear-hem', hem[1]), 46, {'top': (0.53, 0.08)}))
    add('tassets', gear(crop('gear-hem', hem[2]), 28, {'top': (0.5, 0.06)}))
    add('apron', gear(crop('gear-hem', hem[3]), 28, {'top': (0.5, 0.06)}))


if __name__ == '__main__':
    for folder in sorted(p for p in CODEX.iterdir() if (p / 'out.png').exists()):
        boxes = pieces(folder.name)
        preview = Image.open(folder / 'out.png').convert('RGB')
        draw = ImageDraw.Draw(preview)
        for i, box in enumerate(boxes):
            draw.rectangle(box, outline=(0, 255, 0), width=2)
            draw.text((box[0] + 3, box[1] + 3), str(i), fill=(255, 255, 255))
        preview.save(folder / 'pieces.png')
        print(folder.name, [(i, b) for i, b in enumerate(boxes)])
