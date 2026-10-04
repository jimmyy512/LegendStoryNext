---
name: 口袋江湖 2
description: 深玉綠銅邊介面承接既有武俠像素角色與探索世界。
colors:
  plate: "#142b27"
  plate-active: "#315249"
  brass: "#b99b60"
  brass-edge: "#e8c983"
  edge: "#789182"
  paper: "#eee4ca"
  selected-text: "#ffd786"
  dark-text: "#13221e"
  muted: "#a7b29c"
  inset: "#10231f"
  shade: "#061512"
  health: "#75d6c0"
  threat: "#ef8d7b"
  body-intact: "#9eb69b"
  body-injured: "#e6ba70"
  body-depleted: "#f1a18b"
typography:
  dialogue-body:
    fontFamily: '"Noto Sans TC", sans-serif'
    fontSize: "19px"
    lineHeight: 1.5
  dialogue-body-compact:
    fontFamily: '"Noto Sans TC", sans-serif'
    fontSize: "16px"
    lineHeight: 1.5
  character-title:
    fontFamily: '"Noto Serif TC", serif'
    fontSize: "28px"
    lineHeight: 1.5
  section-title:
    fontFamily: '"Noto Sans TC", sans-serif'
    fontSize: "24px"
    lineHeight: 1.5
  title:
    fontFamily: '"Noto Serif TC", "PMingLiU", serif'
    fontSize: "20px"
    lineHeight: 1.5
  heading:
    fontFamily: '"Noto Sans TC", sans-serif'
    fontSize: "18px"
    lineHeight: 1.5
  body:
    fontFamily: '"Noto Sans TC", sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  primary-label:
    fontFamily: '"Noto Sans TC", sans-serif'
    fontSize: "16px"
    lineHeight: 1.5
spacing:
  row: "10px"
  dialogue-row: "12px"
  folio-row: "16px"
  content-inset: "20px"
  folio-margin: "24px"
components:
  button:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    height: "44px"
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.dark-text}"
    typography: "{typography.primary-label}"
    height: "44px"
  button-selected:
    backgroundColor: "{colors.plate-active}"
    textColor: "{colors.selected-text}"
    typography: "{typography.body}"
    height: "44px"
  name-input:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
    height: "48px"
    padding: "12px"
  folio-navigation:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
    height: "61px"
  folio:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
  inventory-cell:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
    height: "100px"
  notice:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
---

# Design System: 口袋江湖 2

## Overview

**Creative North Star: "既有武俠像素世界的深玉綠銅邊木牌"**

延伸既有女主角的分層像素方向：深色輪廓、可辨識的色塊、青松與灰石場景，搭配深玉綠操作面板和暖白文字。銅色邊框標示主操作與選取狀態；人物、物品、場景承擔世界感，介面負責清楚呈現當下可做的事。

這份紀錄依目前 Pixi source 抽取，範圍是探索、角色、行囊、手札、對話及共用戰鬥控件；不是第一章完整通關或可發布的驗收。方向出自 `.impeccable/direction.md` 的 incumbent extension，沒有新 comp 或隨機概念的批准紀錄。`src/style.css` 的舊 DOM 頁面樣式不作為正式遊戲面板的 token 來源。

**Key Characteristics:**
- Pixi 畫布內的切角木牌、銅邊選取與局部捲動。
- 像素人物和透明物品圖，保留可辨識的輪廓。
- 分類與內容分開，對話獨立固定於畫面下方。

## Colors

深玉綠承托暖白，銅色與戰鬥狀態色只在具體功能出現。

### Primary
- **Brass / Brass Edge:** 主操作填色與主操作、已選取項目的亮邊。
- **Selected Text:** 已選取的一般控件文字。

### Secondary
- **Health / Threat:** `BattleHud` 中我方生命與敵方威脅；狀態仍以文字、數字及長條一同呈現。
- **Body Intact / Injured / Depleted:** 人體耐久圖的綠、黃、紅；滿耐久為綠，耐久大於零但未滿為黃，歸零為紅。頭胸腹歸零稱「重傷」，四肢歸零稱「失能」，不以同一字眼混稱。

### Neutral
- **Plate / Plate Active:** 一般底板與選取底板。
- **Paper / Dark Text:** 一般文字與銅色主按鈕上的深色文字。
- **Edge / Muted:** 未選取邊框及次要段落。
- **Inset / Shade:** 角色展示區、戰鬥底座及模態遮罩。

**The State-and-Words Rule.** 選取、裝備、藥品可用性與任務進度同時呈現文字狀態；顏色不獨自承擔意義。

## Typography

面板標題使用 Noto Serif TC，內文與控件使用 Noto Sans TC；來源為 `widgets.label` 與 `PanelOverlay.drawHeader`。字型由 `src/style.css` 載入。未宣告獨立 display、全域粗體或字距 token。

### Hierarchy
- **Title:** 面板名稱；使用 frontmatter 的 title。
- **Heading:** 物品、招式、裝備等內容小標；使用 heading。
- **Body:** 段落與一般控件；使用 body，依可用寬度換行並允許中文斷行。
- **Primary Label:** 銅色主操作；使用 primary-label。

滿版角色頁另使用 28px serif 頁名與 24px sans-serif 內容標題；內文依用途使用 14–16px。首頁名稱是此場景專用的 Noto Serif TC 78px／窄版 52px，不推廣成一般面板標題。

對話正文使用 dialogue-body；實際對話面板寬 `<620px` 時改用 dialogue-body-compact。這個較大的閱讀字級套用於人物與物件對話正文，不改變一般按鈕與 notice 內文字級。

現有 12px 副標與 10px 捲動提示是次要文字實作，後者未列入可繼承字級。角色名稱輸入目前是 18px sans-serif，屬系統輸入字體，不能視為新的展示字體。

## Layout

正式遊戲是滿版 Pixi 畫布；`fullscreen.css` 關閉文件捲動。下列尺寸均為 renderer 的邏輯像素，不是 CSS grid 或 rem。

- **Folio:** 寬 `min(900, viewportWidth - 24)`，高不超過 `viewportHeight - 24`。以實際面板寬 `<620` 切換手機版，因此不是一律以 viewport 620px 作斷點。
- **Desktop folio:** 分類區寬 208px、左起 16px；內容左起 252px，右留 24px。導航 61px 高，間隔 7px；內容間隔 16px。
- **Mobile folio:** 手札等一般分類排兩欄，內容接在下方。分類和內容各自使用 ScrollBox。手札按內容量收縮；角色與行囊已改用各自滿版版型，不再套用舊 folio 的固定高度。
- **Character sheet:** 滿版不透明底，寬 `<850px` 使用窄版。桌面左右外距 26px、分類寬 138px／按鈕高 74px／列步距 86px，人物欄寬 `min(330, areaWidth * 0.43)`，與右側資料間隔 26px。分類與人物保持可見，只有右側資料捲動，內容間距 18px。
- **Compact character:** 左右外距 12px，四個分類在 y=116 排成單列、高 46px；內容從 y=178 起垂直捲動。只有俠客與衣冠分頁把 430px 高人物裝備區置於內容頂端，武學與傷勢直接顯示資料。手機人物隨內容捲動，不能宣稱人物固定。
- **Title scene:** 獨立滿版山景覆蓋探索場景與物件，山景依 cover 比例並靠右對齊；左側暗色漸層承托名稱與選單。寬 `<760px` 使用窄版；高度 `<550px` 隱去引言並壓縮起始位置。選單寬 `min(278, viewportWidth - 56)`，高 48px，列步距 60px。
- **Creation:** 獨立版型最寬 1060px，四周至少 12px；面板寬 `<680px` 使用窄版，高度上限分別為 790px／660px。桌面左側山景敘事欄、右側姓名與路線選項；窄版直接排列輸入與選項。路線卡高 112px／124px，主要開始按鈕與捲動內容分開。
- **Inventory sheet:** 滿版 Pixi 行囊，外框距四邊 8px；寬 `<900px` 改為窄版。桌面內容左右外距 32px，人物穿戴欄寬 `min(310, areaWidth * 0.28)`，背包欄寬 `min(410, areaWidth * 0.35)`，其餘寬度交給詳情，欄距 20px。三欄從 y=100 起各自捲動，可用高度為 `viewportHeight - 122`。
- **Inventory grid:** 欄數 `max(3, floor(gridWidth / 90))`，格高 100px，格間距 8px；全部物品至少保留三列，部位篩選至少一列，空格禁用。物品格含圖像、名稱、數量與「穿戴中」狀態，選取沿用銅框。
- **Compact inventory:** 左右外距 16px；人物穿戴區高 360px，其後接格狀背包與詳情，全部在同一垂直 ScrollBox，元素間距 18px。選取物品後捲向詳情區，不另開彈窗；因捲動底界限制，詳情不保證貼齊內容頂端。
- **Dialogue:** 寬 `min(960, viewportWidth - 24)`，距底 12px；人物欄桌面 190px、手機 124px；選項放在對話正文下方並局部捲動。
- **Object dialogue:** 物件圖使用同一底部版型，最寬縮為 700px；圖欄桌面 116px、手機 84px，正文區至少 100px。沒有圖時正文區至少 64px，避免套用人物半身像的留白。
- **General panel:** 四列以內最寬 480px，其餘 660px；左右至少 12px，垂直至少 8px，內容間距 10px，過長內容局部捲動。
- **Notice:** 最寬 480px、四周至少 12px，內容捲動與底部操作區分開；雙按鈕時取消在左、銅色主要操作在右，按鈕高 44px、間距 12px。
- **Battle dock:** 高度依序判定：畫面高 `<520` 時，交鋒中 140px、結算 186px；否則寬 `<620` 時 354px，其餘 240px。橫向緊湊版將走位與技能並排，下方保留主要指令列。
- **Battle framing:** 取景中心與寬度納入人物完整姿勢輪廓，保留各角色本場已出現過的最大範圍，減少揮擊造成鏡頭反覆縮放。背景以地面基準等比補足取景高度，不拉伸圖稿。
- **Battle outcome:** 戰後在原 dock 範圍內改顯示結算，保留上方角色與場地。內容最寬 1120px，左右至少 16px；桌面左欄占 48%、右欄從 54% 開始。傳入 dock 寬 `<620px` 且高 `>220px` 時改為直向單欄；dock 高 `<200px` 使用橫向緊湊兩欄與縮小字級。以上高度指 dock，不是整個 viewport。返回探索主按鈕高 46px，單欄滿內容寬，兩欄最寬 300px。

**The Local-Scroll Rule.** 長清單只在所屬分類或內容區捲動，保留面板標題與關閉操作。

## Elevation & Depth

共用面板以深色模態遮罩、不透明玉綠底板和邊線建立層次，沒有共用硬偏移陰影。遮罩 alpha 為 0.65；`panelBacking` 底板 alpha 為 1，疊加每 6px 一條的低透明細紋、標題暗帶及四角銅釘。有 subtitle 時標題分隔線位於 y=70，否則 y=55。姓名輸入使用的 surface 為 0.92、按鈕底色為 0.96。角色展示區具有低透明度橢圓地影；它是人物接地線索，不是卡片陰影 token。

## Shapes

`drawGamePlate` 使用八邊切角：`min(7, max(3, floor(min(width,height)/7)))`。未選取邊線 1px，主操作與已選取邊線 2px；上緣細亮線與底部短線是木牌原生裝飾。切角不是 border-radius，frontmatter 不虛構 rounded scale。探索人物名稱小牌仍使用 5px 圓角；這是世界標籤的既有局部形狀，不禁止它，也不推廣至所有面板。

## Components

### Buttons

切角實心木牌。一般高度 44px；長動作依文字內容增加高度。主操作、已選取、禁用由資料狀態決定；禁用 alpha 0.4 且不觸發操作。共用 control 的 pointerover／pointerout 顯示／隱藏透明填色的銅邊疊層；mouseover／mouseout 亦接到同一處理，承接安裝版 Pixi accessibility 的焦點事件。禁用時不顯示。獨立繪製的戰鬥／人體控件仍不能直接宣稱已有相同焦點外觀。

動態控件文字透過 `accessibleLabel` 同步 accessibleTitle 與既有代理的 title、aria-label，避免戰鬥按鈕的語音名稱停留在舊狀態。

`keyboard-focus.jpg` 記錄主選單「踏入江湖」的鍵盤焦點金框；這項個別操作證據不擴大為全介面無障礙驗收。

### Inputs / Fields

姓名以 Pixi NameInput 連接原生鍵盤，48px 高、12px 內距、最多 12 字。resize 時保留輸入實例以免打斷中文組字。sidecar 的 HTML input 僅是外觀預覽，不取代這個 runtime。

### Navigation

雙行分類木牌呈現名稱與用途／狀態；角色有俠客、武學、傷勢、衣冠。衣冠目前提供束髮、髮髻、斗笠三種真實選項；舊 Hair3 存檔映射束髮，不展示重複選項。

滿版角色頁在窄版只顯示分類名稱，桌面保留雙行說明。人物欄下方五個 82px 裝備格分成三欄兩列，分別為武器、上衣、褲子、鞋子與頭部飾品，可開啟行囊的指定物品；空格則開啟行囊。

### Character / Skills

角色總覽呈現生命、內力、修為、能力數值、傷勢概況與當前武學；能力來源拆成根基、境界與目前裝備加成。技能圖格選取後顯示該技能說明、內力消耗、肢體需求、倍率與交鋒用途。總覽技能格高 96px，武學分頁選取格高 112px；均沿用現有圖像與銅邊選取。這是資訊選取與戰鬥預約說明，沒有新增天賦或招式裝卸規則。

### Title / Creation

首頁提供繼續旅程、開始新旅程、讀取存檔，沿用銅色首要操作與玉綠次要操作。首頁山景是獨立 title-scene，不顯示可互動的探索人物與標籤。建立角色延續同一世界，路線選項以兵器圖、用途與「已選定」文字輔助選取，不增加新的成長規則。

### Transient Notifications

短通知沿用切角木牌，最寬 420px 且左右至少 16px，高至少 84px；圖示 44px。獎勵使用木箱、不可通行使用 waypoint、存檔／備份及一般消息使用手札圖。桌面靠右 24px、y=120；寬 `<640px` 改為置中、y=112。停留 4.2 秒，新消息取代舊消息並重設計時；不攔截 pointer 事件。這是非模態通知，與需要確認的 notice 視窗分開。

### Folio / Inventory / Journal

行囊的穿戴、背包與物品詳情共用同一頁和即時 GameState。人物展示沿用 PixelBattleHero；點穿戴格篩選同部位候選，並保留「全部物品」入口；點背包格選取物品。五個欄位獨立替換，不會整套覆蓋。詳情包含透明物品圖、用途、效果、數量與可用動作；滿生命／內力時藥品按鈕禁用並說明原因。

武器／防具比較先複製 state，以 `equip` 套用候選，再以 `getStats` 取得換裝後攻擊、防禦、身法與差值；只有可穿戴且尚未穿戴的候選顯示比較，不用手寫加成冒充結果。已穿戴物品提供真實「卸下裝備」操作，`unequip` 清除對應穿戴欄，物品持有數量不變；不適用的武學路線會說明無法穿戴。同頁概念參考一代 ItemScene，配色延續本作玉綠銅色。

任務仍使用 folio 主支線與真實目標資料，不把裝飾文字當成任務進度。

### Body Status

七部位人體耐久示意圖由 Pixi 多邊形、連線及數值卡構成，是互動資訊圖，不是女主角或敵人的角色美術。左右以角色自身為準；可點人體區域或部位卡，預設選取耐久比例最低部位。顏色之外亦顯示狀態、當前／上限數值、長條和選取邊框，下方呈現該部位影響與恢復方式。

內容直接依 `game/body.ts`：部位耐久獨立於生命；兩腿可用時移速 100%，一腿可用 55%，無可用腿但尚有手時 20%，手腳皆不可用時為零。招式威力依所需手腳與可用肢體比例計算；單手招式可換手。頭、胸、腹耐久不單獨改變移速或招式威力。藥品僅補生命／內力，山門休養才恢復部位耐久。

移速為零時，傷勢頁在人體圖之前顯示「求援回山門」，沿用已選取木牌的銅框強調。正式角色骨架另依左右手與腿的真實耐久呈現失能肢體、傷腿拖行，以及雙腿失能但尚有手時的支撐爬行；這些是同一角色的狀態表現，不另立角色美術風格。

### Confirmation Notice

確認視窗沿用同一切角底板與銅色主操作。正文在上、固定操作帶在下；第一個 action 是右方主操作，其餘 action 依序往左排列。這是 `notice` 版型的實際行為，不把一般 folio 操作也強制排列到右下角。

### Sparring Lessons

入門切磋在實際戰況觸發兩段提示，沿用 notice 與主操作在右的版型，並標明 1 / 2 或 2 / 2、已暫停。第一段在對手重擊起手、位於威脅範圍且玩家可防禦時出現，提供立即防禦與略過教學；第二段在重擊後露出破綻時呈現，內容依真實事件分辨落空、擋下傷害或受到傷害，提供暫停選招與繼續交鋒。沒有關閉叉號，使用明確的略過／繼續動作退出，不把教學當作強制完整閱讀的故事對話。

### Battle Outcome

戰鬥結束後，以結算 dock 取代失效的戰鬥操作列。標題、銀兩與修為、境界進度、取得物品、傷勢及下一步共同形成結算摘要；沿用玉綠底座與銅色文字、銅色返回探索按鈕。一般標題 27px serif，緊湊 dock 21px；這些局部字級不改寫共用面板標題。

摘要透過複製玩家狀態再執行既有 `settleBattle` 預覽，讀取真實獎勵、升級與任務結果。顯示結算本身不發獎；離開戰鬥才正式套用。已領過獎勵、撤退、戰敗均有對應文案，不把每場結束都表達成得獎。

### Dialogue / World Art

人物、角色身分、當前頁數、正文和選項保持同一敘事關係。受傷山賊使用獨立 `portrait:bandit` 半身圖；其他 NPC 仍沿用角色圖裁切，不能宣稱所有人都已有專用半身像。場景與對話圖採 nearest sampling；物品透明貼圖保留清楚輪廓。來源 prompt 與 runtime `.webp.json` 保留資產來歷，不是 comp 批准證明。

木箱、酒壺、採集植物與線索分別沿用 `item-icon:chest`、`wine`、`flower`、`journal` 作為對話圖示；物件保持完整輪廓，以較窄的圖欄和面板承托短敘述。

五位一般 NPC 使用 `public/assets/characters/npcs/ensemble-v2.json`／`.png` 共享圖集，站立與手勢兩個 pose 以共享 source size 和腳底基準對齊。世界 sprite anchor 為 `(0.5, 1)`，按站立材質高度縮至 62 個世界邏輯像素；實際畫面尺寸仍受場景縮放影響。主角探索 scale 為 0.5。手勢以兩張 pose 切換並加少量位移／呼吸，不是完整逐格動作或所有戰鬥敵人的統一改稿。圖稿來源與整理方式見 `art/characters/npcs/ensemble-v2.provenance.json`。

## Do's and Don'ts

### Do:
- **Do** 延伸既有像素女主角的輪廓與色塊關係，透明物品圖與場景保持一致。
- **Do** 用狀態資料同時決定文字、選取與禁用行為。
- **Do** 依實際面板寬度切換分類排版，長內容採局部捲動。

### Don't:
- **Don't** 將舊 DOM 頁面的視覺規則直接當作 Pixi 面板規則。
- **Don't** 把三個可選髮型加上舊 alias 說成四個不同造型。
- **Don't** 把 source extraction 或局部截圖視為全章完成與發布驗收。

未制度化／未修復：BattleHud 既有 glyph 狀態符號、10px 輔助字、部分 24–28px 戰鬥按鈕，以及獨立戰鬥／人體控件的焦點覆蓋仍需後續可讀性／可操作性檢查；本次僅記錄系統，不能用 token 將缺陷合理化。舊 CSS 的 eyebrow／tiny-label 也不列入規範。

本輪延伸另核對 `PixelHeroine.ts`、`PixelBattleHero.ts`、`PanelView.ts` 與共用控件實作，並查看 `object-dialogue-desktop.jpg`、`object-dialogue-mobile.jpg`、`rescue-before.jpg`、`rescue-after.jpg`、`fist-chapter-complete.jpg`；局部狀態與結局截圖不推導整章所有路線的驗收。

滿版角色／首頁重設依 `CharacterSheet.ts`、`GameView.ts`、`PanelOverlay.drawCreation` 記錄，核對 `character-redesign-desktop.jpg`、`character-redesign-mobile.jpg`、`title-redesign-desktop.jpg`、`creation-redesign-mobile.jpg`。這次版型重設由使用者要求，保留既有像素、玉綠、銅色 identity，不重新宣告整套世界或全章驗收。

滿版行囊與 NPC 延伸核對 `InventorySheet.ts`、`PanelView.ts`、`game/state.ts`、`PixelWorldActor.ts`、`ExplorationScene.ts`、圖集 provenance，並查看 `inventory-comparison-desktop.jpg`、`inventory-detail-mobile.jpg`、`ensemble-temple.jpg`；只記錄本次實作範圍，不推定敵人美術或全部動畫完成。

切磋／結算延伸核對 `game/SparringLesson.ts`、`storyPanels.sparringLessonPanel`、`PanelOverlay.drawDialogue`、`BattleOutcome.ts`、`game/battleOutcome.ts`，並查看 `iteration2-heavy-lesson.jpg`、`iteration2-lesson-mobile.jpg`、`iteration3-outcome-desktop.jpg`、`iteration3-outcome-mobile.jpg`。手機截圖中的場景底色帶屬待修鏡頭缺陷，不納入留白規範；viewport accessibility 修復屬行為修正，不另立視覺模式，也不構成全章驗收。

來源核對：`src/ui/canvas/widgets.ts`、`PanelOverlay.ts`、`model.ts`、`storyPanels.ts`、`BattleHud.ts`、`BodyStatus.ts`；`src/ui/PanelView.ts`、`src/game/appearance.ts`、`src/game/body.ts`、`src/render/scenes/ExplorationScene.ts`；`src/style.css`、`src/ui/fullscreen.css`；`PRODUCT.md` 與 `.impeccable/direction.md`。新增模式另核對 `.impeccable/review/mobile-body.jpg`、`desktop-bag-grid.jpg`、`mobile-notice.jpg`；截圖尺寸僅屬各次 capture，不是通用視窗規範。
