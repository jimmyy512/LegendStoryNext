# 行囊與場景物件

`source/inventory-atlas.png` 提供十二種道具的原始圖示。`source/world-props.png` 為後續統一粗像素輪廓的藥品、寶箱與酒壺，覆蓋對應輸出。兩張均保留原生透明通道，不可轉成 RGB，否則透明區藏有的顏色會變成方形底圖。

執行 `python tools/buildInventoryIcons.py` 輸出行囊 WebP 與半身山賊肖像。runtime 圖示在 `public/assets/icons/items/`，山賊肖像在 `public/assets/characters/enemies/bandit-portrait.webp`。生成提示詞嵌於來源 PNG，衍生來源保留在 WebP 的 JSON sidecar。場景與行囊共用寶箱／酒壺／藥品輪廓。
