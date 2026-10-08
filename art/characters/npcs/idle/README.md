# NPC 逐格待機

做法參考 agent-sprite-forge 的「一張核准原畫 → 動作影格」：以 `ensemble-v2.png` 的站姿當身分參考，由 Codex `image_gen` 依版面導引產出一列 4 格待機循環，再交給程式去背、對位。Codex 訂閱沒有圖生影片，因此用單張多格的 sheet 取代原流程的影片步驟。

1. 參考圖：`python3 tools/buildNpcFrames.py refs <id>`，從 NPC 圖集裁出站姿與手勢貼在洋紅底上，輸出到 `refs/`。
2. 版面導引：1536×1024 洋紅底，4 欄各 384 px，青色腳底線在 y=900。
3. 生成：`codex exec -s workspace-write -i <ref.png> -i <guide.png> - < <id>-prompt.txt`，提示詞存在本資料夾。
4. 處理：`python3 tools/buildNpcFrames.py build <id> idle|gesture art/characters/npcs/idle/<id>-<action>-sheet.png`
   輸出 `public/assets/characters/npcs/<id>-idle-v1.{png,json}`，高度對齊站姿，腳底置中於格底。
5. 在 `src/data/npcFrames.ts` 登記影格數。

驗收：縮到遊戲高度 62 px 檢查身分、腳底不滑、頭髮不被遮罩切到。生成結果不一致時重新生成，不要手修單格。
