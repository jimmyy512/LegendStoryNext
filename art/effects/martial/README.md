# 掌法與兵器特效

入口：`?preview=pixel-rig`。空手與拳套出招播「掌法特效」選單選定的招式，劍、刀、槍、扇、鏢各播自己的特效（`w-<兵器>`）。

## 產生

提示詞在 `tools/pixelEffectJobs.json`：每招一張 3×2 格、六格的像素特效表，出手點固定在每格左緣正中，特效往右推進。

```sh
python tools/pixelCodex.py tools/pixelEffectJobs.json [名稱 ...]   # 平行產圖到 art/effects/martial/<名稱>/out.png
python tools/pixelEffects.py                                       # 切格、縮成 1:1 像素，輸出 public/assets/effects/martial/
```

- `pixelCodex.py` 跑完一律從紀錄裡的 session id 取這次工作自己的圖。Codex 自己存檔時會抓全域最新的圖，平行跑會拿到別的工作的圖。
- `pixelEffects.py` 以連通圖塊的重心決定屬於哪一格，畫超出格線的部分不會被切斷。六格以聯集外框裁切，出手點換算成錨點。

## 播放

`src/render/MartialEffects.ts`：六格共 0.75 秒。前兩格（蓄勁、出手）在出手點，之後逐格整數位移往前推，最後一格比原圖再遠 `EFFECT_TRAVEL` 像素。一陽指、六脈神劍、長槍這類光束改為往前拉長，不脫離出手點。

## 招式

降龍十八掌、太極拳、七傷拳、九陰白骨爪、黯然銷魂掌、蛤蟆功、玄冥神掌、落英神劍掌、一陽指、六脈神劍、火焰刀、大力金剛掌。兵器：長劍劍氣、彎刀刀罡、長槍槍芒、摺扇扇風、飛鏢暗器。
