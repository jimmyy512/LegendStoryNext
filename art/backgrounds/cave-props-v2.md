# 藏霧洞物件拆層

Built-in imagegen，precise-object-edit。參考 public/assets/backgrounds/exploration/cave.webp。
生成原檔 art/backgrounds/cave-clean-v2.png；遊戲資產 public/assets/backgrounds/exploration/cave-clean-v2.webp。
原圖保留。以 FFmpeg nearest 縮放到 1152×720，WebP quality 90。

## 完整提示

Use case: precise-object-edit. Production pixel-art RPG exploration background. Edit this exact cave map, preserve its framing, pixel-art style, palette, paths, cliffs, water, vegetation, lanterns and all terrain positions. Remove ONLY the open book lying on the little rocky shelf near x330-385 y305-343 and the closed chest near x954-1003 y50-95 (coordinates in reference 1152x720). Replace the book with the underlying bare mossy stone shelf and replace chest with underlying bare sandy ground. No new objects, no characters, no text. This is a clean background plate so gameplay can render removable book and opening chest sprites separately. Keep same full landscape composition and aspect ratio.

## 遊戲組裝

手札沿用 journal 物品圖，置於可接近的道路格；拾取後移除。箱子共用 closed/open 精靈與 opened 存檔狀態。守敵及首領往道路內側移動，原道路遮罩未更動。
