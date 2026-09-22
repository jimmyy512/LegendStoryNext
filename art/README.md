# 口袋江湖美術原始資源

美術原始檔與遊戲程式保存在同一個 Git repository。`art/` 不放在 `public/`，避免把可編輯專案與製作草稿一併發給瀏覽器。

## 目錄

| 路徑 | 用途 |
| --- | --- |
| `characters/hero/source/` | 原始生成圖、概念圖、提示與來源紀錄 |
| `characters/hero/images/` | Spine 使用的獨立透明拆件圖 |
| `characters/hero/spine/` | 可編輯 `.spine` 專案與匯出設定 |
| `../public/assets/characters/hero/` | 遊戲實際載入的骨架、atlas 與 PNG |

只有完成匯出與驗證的素材才進 `public/assets/`。原圖、拆件與 `.spine` 都要進版控，不能只留下 atlas。不要加入 Spine 軟體本體、啟用碼、帳號設定或第三方無散布授權的素材。

目前先使用一般 Git 保存這批小型樣板。大量 PSD、影片與大型原圖導入前，再一起設定 Git LFS 與遠端支援，不先加入無法下載的 LFS 指標。

## 狀態

- 第一張 AI 角色拆件原圖已保存，屬於製作樣板，尚未驗收為正式美術。
- AI 樣板已拆圖、建立 Spine 專案並匯出，可在 `?preview=spine` 驗證換裝與基本動作。尚未接入主線遊戲。
- 新專案使用實際可下載的穩定版 Spine 4.3.26 Professional，Pixi runtime 固定 4.3.13。啟動器版本為 4.3.06。
- 使用者已同意新專案採最新版。官網列出的 4.3.27 當次下載回報不存在，因此固定 4.3.26，不使用 beta。
- 原版主角已保留到 `characters/legacyHero/`，待機、跑步、三段普攻與普通眨眼已移植到 Spine，可在 `?preview=legacy` 檢查。其餘招式、表情、傷勢與正式遊戲整合仍待完成。
- `.spine` 與 runtime 的 major/minor 版本必須配對，launcher 版本不等於 editor 版本。

製作規格見 [角色樣板](characters/hero/README.md)。
