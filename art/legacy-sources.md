# 一代本地來源索引

2026-09-22 依本機檔案盤點。使用者已授權二代按需要使用原始美術。

- 一代程式：`C:\git\LegendStory`，大學專題原作。
- 二代程式：`C:\git\LegendStoryNext`。
- 原始美術：`D:\專題\ProjectAsset\ProjectAsset`。

## 原始美術

| 資料夾 | 已確認內容 | 二代用途 |
| --- | --- | --- |
| `MainCharacter/龍骨` | `專題新骨骼.dbproj`、character 骨架與圖集 JSON，主角目錄共 111 張 PNG | 核對原版動作、換裝拆件及現有 Spine 轉換 |
| `NPC` | 6 份 `.dbproj`、7 份 `.ai`、348 張 PNG | 全真派人物造型與動作來源 |
| `monster` | 4 份 `.dbproj`、6 份 JSON、235 張 PNG | 敵人造型與動作來源 |
| `Map` | `全真教場景.ai`、`後山背景.ai`、`野外場景.ai`、`全真秘洞.psd` | 場景重畫時參考原作配色、建築與構圖 |
| `MapObject` | 2 份 `.ai` | 地圖物件來源 |
| `InterFace` | 18 份 `.ai`、2 張 PNG | 選單、背包、任務、商店、藥品與 HUD 原稿 |
| `Effect` | 1 份 `.ai` | 特效來源 |
| `LegendStoryStudio` | Cocos Studio `.csd`／`.csb`、161 張 PNG 等 | 舊介面配置與已匯出素材參考 |

檔案數為這次磁碟盤點，不代表全部已檢查視覺品質或可直接載入 Pixi。DragonBones 專案需經轉換與實際動畫驗證。AI／PSD 尚未逐張開啟驗收。`Server` 不屬於本次美術盤點範圍。

## 劇情與人物對照入口

一代 `Resources/json/Mission_TW.json` 包含初入全真、掌門及徐長卿、洪長恨、蘇長胤、王長風、陳長悟等人物任務。對白參考同目錄 `Drama_TW.json`、`NPC_TW.json` 與 `NPC_CODE_TABLE_TW.json`，物品參考 `ItemDOC_TW.json`。

二代現行內容集中於 `src/game/story.ts`、`src/data/content.ts`、`src/data/maps.ts`。沿用人物與故事背景時，以現行半即時戰鬥設計及第一章完成清單決定實作範圍。

## 使用方式

保留來源原檔，需要移植時把該角色或物件所需的可編輯檔與拆件複製到二代 `art/` 並記錄來源相對路徑。完成轉換與畫面驗證的遊戲匯出檔才放入 `public/assets/`。大型 AI／PSD 導入前依 `art/README.md` 評估儲存方式。

目前只完成來源盤點，尚未匯入這批新提供的美術。場景重畫仍依既有設計進行。
