"""金庸掌拳指法特效：把 Codex 產的 6 格特效表（洋紅底、3×2 格）切成 1:1 像素逐格動畫。

    python tools/pixelEffects.py

來源 art/effects/martial/<id>/out.png，產圖設定在 tools/pixelEffectJobs.json。
每格的出手點固定在格子左緣正中，縮圖後以六格的聯集外框裁切，出手點換算成錨點，
輸出 public/assets/effects/martial/<id>.png（橫排六格）與 effects.json。
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

from pixelCodexParts import fit, key_out

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/effects/martial'
PUBLIC = ROOT / 'public/assets/effects/martial'
SCALE = 0.27  # 512 的格子縮成約 138 px，約為 Codex 原圖像素的 1:1
COLS, ROWS = 3, 2
PAD = 2

NAMES = {
    'xianglong': '降龍十八掌',
    'taiji': '太極拳',
    'qishang': '七傷拳',
    'jiuyin': '九陰白骨爪',
    'anran': '黯然銷魂掌',
    'hama': '蛤蟆功',
    'xuanming': '玄冥神掌',
    'luoying': '落英神劍掌',
    'yiyang': '一陽指',
    'liumai': '六脈神劍',
    'huoyan': '火焰刀',
    'jingang': '大力金剛掌',
    'w-sword': '長劍劍氣',
    'w-saber': '彎刀刀罡',
    'w-spear': '長槍槍芒',
    'w-fan': '摺扇扇風',
    'w-darts': '飛鏢暗器',
}
# 光束類從出手點往前拉長，其餘整團往前推進（見 src/render/MartialEffects.ts）。
STRETCH = {'yiyang', 'liumai', 'w-spear'}


def frames(sheet: Image.Image) -> list[Image.Image]:
    """切成六格。以連通圖塊的重心決定屬於哪一格，Codex 畫超出格線的部分不會被切斷或跑到隔壁格。"""
    cw, ch = sheet.width / COLS, sheet.height / ROWS
    data = np.asarray(sheet)
    solid = data[..., 3] > 0
    labels, count = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
    centers = ndimage.center_of_mass(solid, labels, range(1, count + 1))
    owner = np.zeros(count + 1, dtype=int) - 1
    for index, (cy, cx) in enumerate(centers, 1):
        if not np.isnan(cx):
            owner[index] = min(ROWS - 1, int(cy // ch)) * COLS + min(COLS - 1, int(cx // cw))
    cell_of = np.where(solid, owner[labels], -1)
    size = (round(cw * SCALE), round(ch * SCALE))
    cells = []
    for cell in range(COLS * ROWS):
        row, col = divmod(cell, COLS)
        layer = data.copy()
        layer[cell_of != cell, 3] = 0
        # 畫布往右多留半格，讓超出格線的部分有地方放；錨點仍是格子左緣正中。
        box = (round(col * cw), round(row * ch), round(col * cw + cw * 1.5), round((row + 1) * ch))
        wide = Image.fromarray(layer).crop(box)
        cells.append(fit(wide, (round(wide.width * SCALE), size[1])))
    return cells


def build(key: str) -> dict:
    sheet = key_out(Image.open(SOURCE / key / 'out.png'))
    cells = frames(sheet)
    solid = np.any([np.asarray(c)[..., 3] > 0 for c in cells], axis=0)
    rows, cols = np.where(solid.any(1))[0], np.where(solid.any(0))[0]
    x0, y0, x1, y1 = cols[0], rows[0], cols[-1] + 1, rows[-1] + 1
    width, height = int(x1 - x0), int(y1 - y0)
    strip = Image.new('RGBA', (len(cells) * (width + PAD), height))
    for i, cell in enumerate(cells):
        strip.paste(cell.crop((x0, y0, x1, y1)), (i * (width + PAD), 0))
    strip.save(PUBLIC / f'{key}.png')
    anchor = [int(0 - x0), int(round(cells[0].height / 2) - y0)]
    return {'id': key, 'name': NAMES.get(key, key), 'file': f'{key}.png', 'frames': len(cells),
            'width': width, 'height': height, 'pad': PAD, 'anchor': anchor,
            'reach': 'stretch' if key in STRETCH else 'travel'}


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    arts = [build(key) for key in NAMES if (SOURCE / key / 'out.png').exists()]
    (PUBLIC / 'effects.json').write_text(json.dumps({'arts': arts}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for art in arts:
        print(art['id'], art['width'], 'x', art['height'], 'anchor', art['anchor'])


if __name__ == '__main__':
    main()
