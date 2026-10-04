# 後山可互動物件拆層

使用內建 imagegen，未使用付費 API CLI。保留原始生成 PNG；發布 WebP 以 FFmpeg 匯出，背景 1152×720、空箱 112×112，透明空箱採無損編碼。

- 背景來源：`art/backgrounds/mountain-clean-v2.png`
- 背景成品：`public/assets/backgrounds/exploration/mountain-clean-v2.webp`
- 開蓋箱來源：`art/items/chest-open-v1.png`
- 開蓋箱成品：`public/assets/icons/items/chest-open-v1.webp`
- 青蘭沿用既有 `public/assets/icons/items/flower.webp`，採集時由世界物件狀態移除。
- 洞穴仍使用舊背景，未宣稱洞穴手札與木箱已拆層。

## 背景生成提示

Use case: precise-object-edit. Asset type: existing 1152x720 pixel-art wuxia game map background, exact geometry used by collision map. Input image 1 is the edit target. Make ONLY TWO small local removals: (1) remove the large clump of prominent white/blue flowers at x155-255 y160-233 near the upper-left path, replace with low green leaves/grass of the surrounding ground, with no blooming flowers in that clump; (2) remove the closed wooden chest at x665-720 y497-550 in the lower-right clearing, fill that exact place with matching ochre soil. These props will be separate game sprites later. Keep every road, rock, cliff, tree, cave entrance, perspective, palette, pixel texture and surrounding small decorative flowers unchanged. Preserve exact composition and 1152x720 framing; no zoom, crop, new objects, characters, text, UI, glow or blur. Output a clean background that aligns exactly over the original map.

## 開蓋箱生成提示

Use case: precise-object-edit. Input is the exact closed chest game sprite to edit. Create its OPEN EMPTY state: same small wooden arched travel chest, same three-quarter view facing front-left, same brown wooden planks, golden metal bands and lock, same pixel-art outline and limited palette. Keep the lower box width, shape and ground baseline matching the reference. Hinge the lid open upwards and backwards, showing a dark visibly empty interior. No treasure, coins, glow, effects, floor or extra objects. True transparent background, sprite fully visible with a narrow transparent margin, crisp pixel art suitable for display at 48px wide. Single sprite only.
