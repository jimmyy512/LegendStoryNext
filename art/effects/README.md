# 第一章戰鬥效果

`source/*.png` 是透明像素原稿；`public/assets/effects/*.webp` 是遊戲載入的壓縮素材。`impact` 是普通命中碎片，`pierce` 是青玉穿刺，`swordfall` 是銀藍落劍，`dragon` 是金色掌勁，`guard` 是玉牌防禦。

生成提示詞共同要求：`isolated transparent pixel-art martial-arts impact sprite, crisp 16-bit pixel clusters, compact filled silhouette, rich internal shading, no text, no character, no speed lines, no thin strokes`。前三張技能圖曾有水平拖尾，已按 `remove every horizontal trailing streak, beam, speed line, thin line, and rectangular colored band; preserve central sculpted impact and transparency` 編修。WebP 使用 Pillow 無損壓縮，效果圖縮至最長邊 512 像素；程式只做時間、縮放與透明度演出。
