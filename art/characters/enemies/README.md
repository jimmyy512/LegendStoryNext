# 第一章敵人素材

`source/*.png` 是 AI 生成的透明像素角色原稿；`public/assets/characters/enemies/*.webp` 是遊戲載入用的壓縮檔。生成時沒有使用一代的角色圖。

| 檔案               | 設計描述                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| `disciple.png`     | 全真試招弟子：青白道袍、頂髻、徒手架式，朝左站立。                            |
| `bandit.png`       | 山道刀客初稿：黃頭巾、破舊深衣、單手大刀。                                    |
| `bandit-chibi.png` | 以 `bandit.png` 編修成較簡潔的 Q 版，保留頭巾、衣裝與大刀；正式遊戲使用此版。 |
| `zombie.png`       | 失心傀儡：破損道袍、木面具、灰綠膚色、雙手前伸。                              |
| `boss.png`         | 洪長恨：灰白長髮、深紅道袍、長劍與凝重神情。                                  |
| `zombie-chibi.png` | 以失心傀儡初稿與 Q 版刀客為參照，收斂身形與像素密度；正式遊戲使用此版。       |
| `boss-chibi.png`   | 以洪長恨初稿與 Q 版刀客為參照，改成較緊湊的首領剪影；正式遊戲使用此版。       |

共同提示詞：`full-body 2D pixel art wuxia game sprite, three-quarter view facing left, transparent background, no text, readable silhouette, crisp pixel edges`。刀客修訂提示詞另指定 `chibi, head roughly one quarter of total height, compact four-head-tall body, flat pixel clusters, no painterly shading or microtexture`。`*-attack.png` 以各角色站姿為編修目標，保留臉、衣裝、武器和比例，改成弟子出掌、刀客劈刀、傀儡撲爪、首領刺劍的出手影格。`*-hurt.png` 同樣保留身份和服裝，改成收手、縮肩與重心後移的受擊影格。戰鬥依事件切換站姿、攻擊與受擊姿勢，配合預備、出手、格擋和倒地節奏。

壓縮：Pillow `Image.save(path, 'WEBP', quality=88, method=6)`，保留透明背景。四位敵人的辨識、強度與招式由 `src/data/content.ts`、`src/game/battle.ts` 管理。
