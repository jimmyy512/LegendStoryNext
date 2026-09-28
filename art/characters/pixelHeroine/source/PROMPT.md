# 像素女俠分件生成

工具：內建 imagegen。
參考：`public/assets/styleComparison/heroine-pixel.png`。
輸出：`parts-v1.png`，實際尺寸 1254×1254，角落 alpha=0。模型未精確遵循 1024 尺寸，因此裁切界線依實際輸出重新量測。

```text
Use case: stylized-concept. Asset type: production pixel-art cutout atlas for a Spine skeletal character prototype.
Reference image is ONLY the heroine's identity, costume, face and pixel aesthetic. Make separate riggable parts for the SAME adult female wuxia heroine: brown high ponytail with red ribbon, ivory and teal tunic, red sash, dark trousers, brown boots. Facing RIGHT in three-quarter side view.
Generate a square 1024x1024 PNG on genuinely TRANSPARENT alpha background. EXACT 4 by 4 uniform grid of 256x256 cells, no borders or text. Sixteen fully ISOLATED disconnected parts, one centered in each cell, generous 20 pixel padding. All parts fit own cells. Every sleeve/limb is drawn pointing straight DOWN with round covered joint caps for overlap, NEVER angled. Same hard-edged 16-bit pixel art, chunky square pixels about 3-4 output pixels wide, limited colors, dark outline, no antialiasing or gradients.
ROW 1 left to right:
1 complete heroine HEAD with face ears bangs and red hair tie, facing right, NO long ponytail and NO neck/body;
2 complete sleeveless ivory/teal TORSO from neck to tunic hem with red sash, no head arms legs;
3 separate flowing brown PONYTAIL with red ribbon, root at top, hair trailing down and left;
4 exact matching sleeveless TORSO, same silhouette and red sash but alternate dark jade-green coat with gold trim.
ROW 2:
1 rear upper ARM sleeve, shoulder at top, elbow at bottom;
2 front upper ARM sleeve, shoulder at top, elbow at bottom;
3 rear FOREARM with brown wrist cuff and OPEN PALM extended down, elbow at top, fingertips at bottom;
4 front FOREARM with brown wrist cuff and OPEN PALM extended down, elbow at top, fingertips at bottom.
ROW 3:
1 rear THIGH dark trousers, hip at top knee at bottom;
2 front THIGH dark trousers, hip at top knee at bottom;
3 rear CALF with brown boot, knee at top sole at bottom, toe pointing RIGHT;
4 front CALF with brown boot, knee at top sole at bottom, toe pointing RIGHT.
ROW 4:
1 isolated straight silver JIAN sword with gold guard brown grip, tip pointing UP, pommel at bottom, no hand;
2 isolated curved DAO saber with silver blade red tassel and brown grip, tip pointing UP, pommel at bottom, no hand;
3 rear FOREARM matching row2col3 but closed gripping FIST instead of palm, includes same wrist cuff, elbow at top fist at bottom;
4 front FOREARM matching row2col4 but closed gripping FIST instead of palm, includes same wrist cuff, elbow at top fist at bottom.
Do not draw full characters. Do not add background, shadows, glows, scene, checkerboard, labels or extra objects. TRUE TRANSPARENCY between all parts. These are clothing-covered animation cutouts, no wounds or gore.
```

