# 原版口袋江湖主角素材

來源：`LegendStory/Resources/CharacterAssert/`，使用者提供並指定評估沿用。原始三個檔案不修改，完整複製到 `source/`。

## 已確認

- `character_tex.png`：1024×1024 透明圖集。
- `character_tex.json`：103 個圖塊，包含裁切前尺寸與裁切偏移。
- `character_ske.json`：DragonBones 5.5，24 fps。
- `MainCharacter`：43 根骨頭、28 個插槽、24 段動畫。
- 另外包含 10 個表情／說話子骨架，不能直接當成主角動畫丟棄。
- `images/`：透過 Spine atlas unpack 拆出的獨立 PNG，保留原名稱與裁切前畫布。

這批是優先沿用的主角素材。`../hero/` 的 AI 圖與 Spine 樣板保留作技術驗證，不代表正式主角美術定案。

## 格式邊界

原檔是 DragonBones，不是 Spine。目前已完成第一批 Spine 4.3 匯入、匯出與瀏覽器播放驗證，不代表全部 24 段動畫都已移植。

轉換需保留骨頭父子關係、插槽順序、換裝 display 對照、旋轉／縮放／斜切、動畫時間軸與子骨架。必須在 Spine 和瀏覽器逐段對照，不只檢查 JSON 能被解析。

圖集內含 `Blody`、吐血表情與攻擊特效等原素材。原始檔完整留存不等於全部在新版啟用。新版部位失能仍採無血腥表現。

## 拆圖紀錄

`source/character.atlas` 依原 `SubTexture` 產生。DragonBones 的負 `frameX/frameY` 對應裁切位置，Spine atlas offset 以左下為原點：

- `offsetX = -frameX`
- `offsetY = frameHeight - height + frameY`
- `orig = frameWidth, frameHeight`

本圖集無 rotated 圖塊。不可只用裁切後尺寸而忽略原畫布，否則匯回骨架時位置會偏移。

於 repository 根目錄執行：

```sh
/Applications/Spine.app/Contents/MacOS/Spine -u 4.3.26 \
  -i art/characters/legacyHero/source \
  -o art/characters/legacyHero/images \
  -c art/characters/legacyHero/source/character.atlas
```

沒有覆蓋舊專案。原主角動畫已接到新版探索與戰鬥，仍待完整旅程驗收。

## 第一批移植成果

- 預覽：`http://127.0.0.1:5173/?preview=legacy`，不讀寫遊戲存檔。
- 待機 `Idle`、跑步 `Run`、三段 `NormalAttack1/2/3`。目前攻擊循環播放方便檢查，不是正式戰鬥控制。
- 普通表情子骨架展開為三根骨頭及眼睛／嘴巴插槽，眨眼獨立播放。
- 三套服裝、四個髮型／斗笠、劍／刀／空手，可在動畫播放時切換。
- `spine/legacy.spine` 為真正的 Spine 4.3.26 原始專案，圖片路徑為 `../images/`。
- `public/assets/characters/legacyHero/` 的檔案由 Spine 官方 CLI 匯出，不直接使用中間檔。

## 尚未移植

其餘 19 段主角動畫、其他表情／說話子骨架、技能特效及龍身網格。第一批刻意排除特效插槽，完整資料仍保存在 `source/` 與 `converted/`。目前未逐幀與原版 DragonBones 播放器對照，不能宣稱動作完全一致。

原版角色已取代探索／戰鬥中的主角示意角色，服裝與武器跟實際裝備同步。`LegacyInjuryPose` 提供執行期垂手、換手持武器、跛行、坐地與爬行覆蓋。這些尚不是精修後的 Spine 傷勢動畫，手掌握持、腳底接地與攻擊姿勢仍需完整驗收。

## 可重現製作流程

官方 `dragonbones-tools@0.1.2` 產生 Spine 3.6 中間檔。`tools/legacySpine.ts` 再將第一批曲線控制點轉為 4.3 的絕對時間與數值，補普通表情子骨架。這不是任意 DragonBones 資料的通用轉換器，遇到未支援區段會報錯。

以下在 repository 根目錄執行。Spine 輸出使用絕對路徑，避免未建立的相對目錄被解讀成相對於 `.spine` 的位置。

```sh
node node_modules/dragonbones-tools/out/convertTo.js -t spine -i art/characters/legacyHero/source -o art/characters/legacyHero/converted
npm run art:legacy:prepare
/Applications/Spine.app/Contents/MacOS/Spine -u 4.3.26 -i "$PWD/art/characters/legacyHero/spine/legacy-source.json" -o "$PWD/art/characters/legacyHero/spine/legacy.spine" --to legacy --replace -r
/Applications/Spine.app/Contents/MacOS/Spine -u 4.3.26 -i "$PWD/art/characters/legacyHero/spine/legacy.spine" -o "$PWD/public/assets/characters/legacyHero" -e json+pack
```

`--replace` 只可用於重建這份移植樣板。開始人工精修 `.spine` 後，另存版本，不再用來源 JSON 覆蓋。

轉換工具來源：[DragonBones 官方 Tools](https://github.com/DragonBones/Tools)。
