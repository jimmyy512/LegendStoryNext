# 第一章戰鬥背景

目前使用 `source/*-stylized.png`，與探索地圖共用輪廓、像素色塊與材質方向。執行 `python tools/buildExplorationMaps.py` 會一併輸出四張戰場，品質 90。原始 `source/*.png` 保留作構圖參照。

`source/*.png` 是 AI 生成的像素戰場原稿；`public/assets/backgrounds/battle/*.webp` 是遊戲用的 WebP。原稿皆保留，四張戰場分別對應松風林、全真派、藏霧洞及後山。使用 Pillow 以 `quality=84, method=6` 壓縮；每張約 300–390 KB。

森林原稿提示詞：`Original widescreen 2D pixel art game background only. A wuxia pine forest clearing with layered dark jade pine trunks, distant teal mountains and mist, worn earth combat arena in the center, stone steps and mossy rocks at the edges. No people, no text, no UI. Strong depth, richly detailed frame, center 60% clear behind characters. Crisp visible square pixels and deliberate pixel clusters, no smooth vector shapes, no blur, no 3D.`

其他三張以森林原稿為風格參照，分別要求道觀石砌庭院、湖畔鐘乳石洞、雲霧山道與遠方吊橋；保留 16:9 構圖、畫面中間的交戰空間、左右框景與清楚的方形像素。正式戰鬥依所在地圖載入對應背景。仍需逐張檢查角色、技能、警示與文字在移動鏡頭時的對比和邊界。
