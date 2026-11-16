# 給 agent 的開工說明

《口袋江湖》v2：Pixi.js 單機武俠網頁遊戲，半即時自動普攻加招式預約、部位傷勢。正式站 https://legend.jimmyy512.com 。Claude 跟 Codex 讀的是同一份（`CLAUDE.md` 只引用這裡）。

- 怎麼跑、各種試玩預覽網址、開發檢查：`README.md`；第一章產品範圍：`PRODUCT.md`；視覺：`DESIGN.md`
- 程式架構：`docs/guides/architecture.md`
- 第一章的完成清單跟所有設計草案在 `docs/plans/2026-09-chapter-one/`（暫停中，最後一個 commit 是 2026-10-09）。戰鬥以 v0.3 為準，v0.2 只剩探索與故事部分有效

## 部署

`docker compose -f docker-compose.prod.yml up -d --build`：靜態檔包進 nginx 容器 `legend`，綁 127.0.0.1:3213，正式流量走 MainNginx 反代。repo 裡沒有部署腳本。

## 文件規矩

1. 一個事實只寫在一個地方，別處放連結。
2. 現況變了就改寫原本那一段，不在後面補「某月某日補」的段落，也不留被推翻的舊說法。經過寫在 commit 訊息。
3. 計畫做完，把結果寫進手冊或本檔，再封存計畫（`archive`）。封存的不再更新。
4. 索引（`docs/PLAN.md`、`docs/DOCS.md`）由腳本產生，不手改。開工先讀 `docs/PLAN.md`、`docs/TODO.md`，規則見 `docs/CONVENTIONS.md`；改 frontmatter 後跑 `node ~/.claude/skills/docs-system/scripts/docs.mjs index --root .`，提示建議升級就 `status --apply`。
