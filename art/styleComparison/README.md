# 女俠降龍十八掌風格比較

入口：`http://127.0.0.1:5173/?preview=styles`。獨立預覽，不讀寫遊戲存檔。

## 兩種實作

- Q 版：九個 AI 分件、十一根 Spine 骨頭，2.8 秒的蓄力、出掌、收招。由 Spine 4.3.26 官方 CLI 匯出，保留可編輯 `spine/heroine.spine`。
- 像素：AI 製作八張不同姿勢，4×2 圖集，每格 384×512。用 Texture frame 切換，不使用 Spine。低解析度畫布和 nearest 縮放保留像素輪廓。
- 金龍：使用者原版 `legacyHero/images/龍身.png`，搭配十八道金色氣痕。像素版使用相同素材在低解析度畫布呈現，尚非另外逐格精繪的像素龍。
- 同步時間軸、循環／單次播放、暫停、三段速度與拖曳進度。

這是風格動態樣片，不是正式女主角定案，也不是十八套獨立招式。AI 像素圖仍可能有逐格造型差異，Spine 分件接縫與掌型需要人工美術精修。

像素風可以透過分層裝備動畫支援換裝，本樣片固定服裝不代表技術上不能換裝。

## 來源與重建

`source/PROMPTS.md` 保存完整提示詞，使用內建 imagegen，不使用 CLI API。原始輸出與透明背景處理後的選用素材保存在本目錄，遊戲引用 `public/assets/styleComparison/`。

1. `node tools/buildComparisonSpine.ts` 產生拆圖 atlas 與 Spine JSON。
2. Spine atlas unpack 將 `source/parts.atlas` 與 `source/heroine-parts-v1.png` 拆到 `images/`。
3. 將 `spine/heroine-source.json` 匯入 `spine/heroine.spine`，再用 `json+pack` 匯出到 `public/assets/styleComparison/`。

所有 CLI 路徑使用絕對路徑。重新匯入只可覆蓋此腳本產生的樣板，不得覆蓋後續人工精修版本。
