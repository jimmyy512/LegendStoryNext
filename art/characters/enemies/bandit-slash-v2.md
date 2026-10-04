# 刀客六格出刀素材

- 工具：內建 image_gen，透明背景。
- 角色參考：`public/assets/characters/enemies/bandit-chibi.webp`。
- 原始輸出：`art/characters/enemies/source/bandit-slash-v2.png`。
- 遊戲資產：`public/assets/characters/enemies/bandit-slash-v2.webp`，1536×1024；3 欄 × 2 列，每格 512。
- PNG 轉 WebP 保留透明度；未對人物內容做程式重畫。
- PixelEnemy 使用各格落腳點校正，依戰鬥事件切換預備、抬刀、命中、跟進、收刀；命中前等待實際 strike 事件。
- 目前僅刀客出刀採用此序列，走路／受傷／倒地沿用既有素材；這不是完整共用骨架。
- 桌面實際畫面：`.impeccable/review/iteration33-bandit-anticipation.jpg`、`iteration33-bandit-contact.jpg`、`iteration33-bandit-follow.jpg`。
- 已知限制：雙敵人的出手仍會同步；尚需改善其他動作銜接與近身武器接觸距離。

## 生成提示

Create a production animation sprite sheet for this EXACT wuxia pixel-art bandit. Reference image is identity/style reference: preserve his face, beard, yellow headband, tied black hair, ragged dark charcoal vest, rust red tunic, olive trousers, wrapped shins and curved dao sword. Crisp chunky pixel clusters, no smooth painting. Output a transparent 3 columns by 2 rows sprite sheet, SIX full-body sequential frames of ONE grounded left-facing sword slash. Equal square cells in a landscape 3:2 canvas, no text, no cell borders, no labels, no effects, no motion lines, no duplicated weapons or limbs. Every pose same character scale and head size; all feet fit fully inside cell; stable foot baseline at 88% of each cell height, hip root horizontally at center. Keep ample empty margin for blade. Six frames in reading order: (1) standing combat-ready, knees flexed, blade forward low as reference; (2) anticipation, weight on back foot, blade drawn up beside and behind shoulder, torso coils; (3) late anticipation, shoulder turns and elbow leads, blade still high, front foot firmly planted; (4) contact pose, decisive forward downward cut toward left, torso rotates, dao extends left slightly below chest, back heel pivots without hopping; (5) follow-through, sword sweeps low toward left, elbow relaxes, bent front knee carries weight, no exaggerated lunge; (6) recovery, draws blade back to low guard and settles over both feet, almost matching frame 1 for a smooth return. Each pose anatomically plausible, correct hand grip and blade connection, exactly two arms/two legs/one sword. This is a coherent hand-animated sequence, not six unrelated attacks. All face left throughout. Use the reference's compact four-head-tall proportions and clothing silhouette. Large high quality sheet suitable for extracting the six cells.
