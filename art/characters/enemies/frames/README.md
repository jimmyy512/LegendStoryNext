# 敵人逐格攻擊與受擊

與 NPC 動作同一套做法（見 `art/characters/npcs/idle/README.md`）：以戰鬥用的站姿、攻擊、受擊圖當參考，Codex `image_gen` 依導引圖產出整組影格，再由程式去背、對位。刀客已有骨架動畫，不在此列。

| 動作 | 版面 | 影格 | 參考圖順序 |
|---|---|---|---|
| strike | 3×2，每格 512 px，兩條青色腳底線 | 站姿、蓄勢、舉起、出手、延伸、收勢 | `refs/<id>-idle.png`、`refs/<id>-attack.png`、`refs/guide-3x2.png` |
| hurt | 1×4，每欄 384 px | 撞擊、最大後仰、穩住、回到架式 | `refs/<id>-idle.png`、`refs/<id>-hurt.png`、`refs/guide-4.png` |

處理：

```
python3 tools/buildEnemyFrames.py <id> strike art/characters/enemies/frames/<id>-strike-sheet.png --rows 2 --cols 3 --scale-frame 0
python3 tools/buildEnemyFrames.py <id> hurt art/characters/enemies/frames/<id>-hurt-sheet.png --rows 1 --cols 4 --scale-frame 3
```

`--scale-frame` 指定哪一格是站姿，那一格會縮放到與待機圖同高。輸出 420 px 高的無損 WebP，`meta.scale` 讓貼圖單位等同待機圖，
腳底放在與待機圖相同的水平位置，`PixelEnemy` 以錨點 (0.5, 1) 與同一個 profile 縮放即可對齊。登記在 `src/data/enemyFrames.ts`。

播放（`src/render/PixelEnemy.ts`）：蓄勢前半段播「蓄勢」、之後停在「舉起」直到出手事件；出手事件從「出手」開始，
依序「延伸」「收勢」，保留一半前衝。受擊時間的 0–20%、20–45%、45–70%、70–90% 各播一格，最後 10% 回到站姿。
