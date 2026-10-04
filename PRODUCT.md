# 口袋江湖 2

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
單人武俠短篇遊戲玩家，在電腦瀏覽器中探索門派、選擇武學路線並完成第一章。手機瀏覽器需能操作，但第一章以電腦體驗為先。

## Product Purpose
讓玩家在約 15–30 分鐘內從「初入全真」開局走到章末；探索、選擇、成長與半即時部位戰鬥都要有可見結果。兩條武學路線及善意／武力分支都必須能完整通關。

## Operating Context
Pixi.js 滿版畫布，點擊移動與互動；戰鬥採自動普攻、預約招式、走位、部位傷勢與戰術暫停。旅程保存在瀏覽器，可匯出與匯入備份。開發預覽頁用於分別驗證像素骨架與戰鬥，不等同正式遊戲流程。

## Capabilities and Constraints
- 第一章包含松風林、全真派、後山、藏霧洞，一條主線、兩條支線、三種普通敵人與一名首領。
- 劍法與拳掌各有兩招武學及一種內功；依 `docs/combat-design-v0.3.md` 的半即時規則實作。
- 角色視覺沿用已選定的分層像素與 Spine 骨架方向；換裝、兵器及技能素材須能持續擴充。
- 遊戲在 `C:\git\LegendStoryNext`；一代 `LegendStory` 僅供內容及原稿參考。
- 正式站為 `legend.jimmyy512.com`，本機開發與驗收不代表已部署。

## Evidence on Hand
- `docs/game-design-v0.2.md`、`docs/combat-design-v0.3.md`、`docs/implementation-checklist.md`。
- `art/characters/pixelHeroine/` 的分層像素角色、動作與換裝來源。
- 第一章規則與存檔已有自動測試；完整視覺品質、一般玩家時長及遊玩趣味仍需實際試玩驗收。

## Product Principles
- 玩家每次選擇要能看見具體後果。
- 敵人招式必須可辨識，讓防禦、移動、部位與技能選擇有意義。
- 角色、敵人、技能及場景維持一致的像素方向。
- 以實際完整通關與遊玩感受判斷完成，不以原型功能存在或建置成功代替驗收。
