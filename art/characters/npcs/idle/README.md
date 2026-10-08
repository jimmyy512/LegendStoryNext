# NPC 逐格待機與手勢

做法參考 agent-sprite-forge 的「一張核准原畫 → 動作影格」：以 `ensemble-v2.png` 的站姿當身分參考，由 Codex `image_gen` 依版面導引產出一列 4 格待機循環或 4 格手勢（起手、半途、完整手勢、收回），再交給程式去背、對位。Codex 訂閱沒有圖生影片，因此用單張多格的 sheet 取代原流程的影片步驟。

1. 參考圖：`python3 tools/buildNpcFrames.py refs <id>`，從 NPC 圖集裁出站姿與手勢貼在洋紅底上，輸出到 `refs/`。
2. 版面導引：1536×1024 洋紅底，4 欄各 384 px，青色腳底線在 y=900。
3. 生成：待機附 `refs/<id>-still.png` 與 `refs/guide-4.png`，手勢再多附 `refs/<id>-gesture.png`（放在導引圖前）：
   `codex exec -s workspace-write -i refs/<id>-still.png [-i refs/<id>-gesture.png] -i refs/guide-4.png - < <id>-<action>-prompt.txt`。提示詞存在本資料夾。
4. 處理：`python3 tools/buildNpcFrames.py build <id> idle|gesture art/characters/npcs/idle/<id>-<action>-sheet.png`
   輸出 `public/assets/characters/npcs/<id>-<action>-v1.{webp,json}`：每格只留最大的圖形（清掉鄰格碎片），高度對齊站姿、腳底置中於格底，
   存成 160 px 高的無損 WebP，`meta.scale` 讓 Pixi 仍以站姿的尺寸單位換算。
5. 在 `src/data/npcFrames.ts` 登記影格數。

驗收：縮到遊戲高度 62 px 檢查身分、腳底不滑、頭髮不被遮罩切到。生成結果不一致時重新生成，不要手修單格。

紀錄：王長風手勢第一次生成時站直變高，提示詞補上「保持低馬步」後重做才通過。
