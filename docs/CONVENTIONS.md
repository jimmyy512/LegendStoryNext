# 文件規範（docs-system，目前 M 級）

> 這份由 docs-system 產生，升級時會覆蓋，請勿手改；要改規則就改 skill。
> 指令：`node <docs-system skill>/scripts/docs.mjs <index|status|new|archive|upgrade>`

## 原則

1. **每個事實只放一個地方**，其他地方只放連結。
2. **索引只放「這份文件是什麼」**：標題、狀態、一行摘要、連結，不放內容。
3. **狀態只寫在文件的 frontmatter**。`PLAN.md`、`DOCS.md`、`DECISIONS.md`、`plans/_archive/INDEX.md`、`guides/INDEX_*.md` 由腳本產生，**禁止手改**；改完 frontmatter 執行 `index`。
4. **內容單向流動**：計畫描述「要改什麼」；完工後，結果寫進手冊（現在是什麼）、理由寫進決策紀錄（為什麼），計畫封存後不再修改。

## 分級

| 級別 | 內容 |
|---|---|
| S | `TODO.md`、`PLAN.md`、`plans/` |
| M | S 的全部，加上 `DOCS.md`、`guides/`、`plans/_archive/` |
| L | M 的全部，加上 `DECISIONS.md`、`decisions/`、`inbox/`，腳本複製到 `docs/tools/` |

只升不降。`index` 或 `status` 提示「建議升級」時，AI 直接執行 `status --apply`，在回覆中說明升級原因。

## 文件類型

| 類型 | 位置 | 放什麼 | 不放什麼 | 生命週期 |
|---|---|---|---|---|
| 計畫 | `plans/<年-月-名稱>/plan.md` | 目標、範圍、設計、**唯一的任務清單**、進度 | 現況說明 | draft → active → done / dropped → 封存 |
| 計畫附件 | 同一個計畫資料夾 | 調查、比較、草稿、AI 產出 | — | 跟著計畫一起封存 |
| 手冊 | `guides/` | 系統「現在」怎麼運作、怎麼用 | 歷史、理由、未來規劃 | 長期有效，直接改寫 |
| 決策 | `decisions/NNNN-名稱.md` | 背景、選項、結論、後果 | 實作細節 | proposed → accepted；要改就寫新決策，舊的標 superseded |
| 待辦 | `TODO.md` | 小事、沒有計畫書的事、有期限的事 | 計畫內的子任務 | 完成就刪除 |
| 收件匣 | `inbox/` | 還不知道放哪的筆記 | — | 分流到上面各類，或刪除 |

`README.md` 只寫專案是什麼、怎麼跑，並連到 `docs/`；不在 README 寫手冊內容。

程式依賴固定路徑、不能搬的檔案或目錄，列在 `docs/.docs-system.json` 的 `ignore`（相對 `docs/`），就不算未歸類。

## 流轉規則

- **TODO 長大了**（超過一個 session 或需要設計）→ `new plan`，從 TODO **刪掉**那一行，不留「見計畫 X」。
- **計畫的子任務**只寫在 plan.md 的 checkbox；索引會自動算進度。
- **計畫完工**：
  1. 把結果寫進手冊（沒有對應手冊就 `new guide`）
  2. 有重大取捨就 `new decision`
  3. 填寫計畫的「結案」段落
  4. status 改成 done（或 dropped）
  5. 執行 `archive <計畫資料夾>`，腳本會搬檔並改寫連結
- **封存文件不更新**；現況以手冊為準。
- **inbox** 每次整理文件時順手分流。

## frontmatter

| 欄位 | 計畫 | 手冊 | 決策 |
|---|---|---|---|
| title、type、summary | 必填 | 必填 | 必填 |
| status | 必填 | — | 必填 |
| created | 有 | — | 有 |
| category | 選填 | 選填 | 選填 |

- `summary` 是索引上的一行摘要，寫清楚到不用打開文件也知道內容。
- 加了 `category` 後，索引會自動分組；手冊超過 40 份時會自動拆成 `guides/INDEX_<分類>.md`。
- 「最後更新時間」不寫進 frontmatter，用 git 查。
