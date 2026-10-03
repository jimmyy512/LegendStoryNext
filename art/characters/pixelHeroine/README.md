# 像素女俠分層骨架試作

入口：`?preview=pixel-rig`。以使用者選定的降龍十八掌比對女俠為造型範本。

## 目前內容（第二版骨架）

- 素材來源為內建 imagegen 產生的 `source/parts-v1.png`，提示詞在 `source/PROMPT.md`。
- 部件先縮成最終顯示尺寸的 1:1 像素：頭、髮、軀幹 0.21 倍，褲管 0.15 倍，手臂與靴子 0.135 倍。每個部件等比例縮放，不再壓扁或拉長。alpha 只保留全透明或不透明。
- 關節點在原稿上量測，記錄於 `tools/pixelHeroineParts.py`，換算後寫入 `source/rig-points.json`。附件以關節點對齊骨頭原點，子骨頭放在下一個關節點，接縫位置由量測決定，不必人工微調偏移。
- 遠側（左）手腳沿用右側素材並壓暗到 80%，兩側造型一致。
- 馬尾根部接在頭部髮髻的紅繩位置，畫在頭後面。小腿裁掉膝蓋圓帽，畫在大腿下層。靴子以腳踝紅綁腿為軸，和小腿接縫重疊。
- 21 根骨頭、12 段動畫。空手與持刃分開待機、走路與攻擊，傷手使用左手專用版本。
- 動作以「世界角度」撰寫（0 朝前、90 朝上、-90 下垂），產生腳本換算成各骨頭的相對旋轉，關鍵格之間用貝茲緩動，出招段落用快速曲線。
- 腳由執行期的雙骨反解控制，鞋底固定在地面高度，靴子保持水平。站定時沉腰 4 像素；走路分成支撐期與抬腳期，重心隨步伐起伏。這段反解在 runtime，編輯器單獨播放不包含它。
- 受擊動作疊在護身姿勢上，只帶動腰、軀幹、頭與馬尾，手中兵刃維持架勢。
- 姿態採樣 24 fps，320×220 畫布、nearest 貼圖與 pixelated 顯示。

## 換裝與兵器（2026-09-23 第三輪）

每一類各自一組 Skin，執行期由 `PixelHeroine.equip(look, injury)` 任意組合：

| 類別 | Skin 名稱 | 目前選項 | 來源 |
|---|---|---|---|
| 衣裝 | `outfit/<id>`（軀幹＋兩臂袖子） | ivory、jade、night、robe、scholar、orchid、hunter | 原稿；night 為換色；後四套為 Codex 重畫 |
| 褲子 | `pants/<id>`（大腿＋小腿） | ink、moon、indigo、umber（燈籠褲換色）、leggings、linen、greaves、wraps、fur | 燈籠褲為換色；後五款為 Codex 重畫的不同版型 |
| 鞋子 | `boots/<id>` | brown、black、white、red | 換色，含金邊色 |
| 髮 | `hair/<color>/<style>`（只有馬尾） | brown、black、silver、auburn、chestnut × 高馬尾／盤髻 | brown 為原稿，其餘 Codex 重畫，盤髻不掛馬尾 |
| 頭（臉型） | `head/<color>/<face>` | 5 髮色 × classic、phoenix（鳳眼）、round（圓臉杏眼）、serene（清冷）、fierce（英氣） | 臉和頭髮在同一張圖上，每種臉型請 Codex 依五種髮色各畫一顆頭（`codex/face-<臉型>`） |
| 手 | `hands/<id>` | palm、grip、knuckle | palm 與走路用的放鬆手為 Codex 重畫（`codex/hands`），knuckle 為握拳加黃銅指虎 |
| 兵器 | `weapon/<id>/<L\|R>` | sword、saber、spear、fan、dart | 長槍、摺扇、飛鏢由程式逐點繪製 |

| 疊加裝備 | `gear/<slot>/<id>` | 頭飾（竹斗笠、束髮金冠）、披風（緋紅、夜藍）、護肩（鐵、皮）、胸甲（札甲）、下擺（墨青、緋紅、札甲腰裙、毛邊獵裙）、佩物（酒葫蘆、玉佩） | Codex 重畫 |

- 疊加裝備各自有插槽（headwear、cape、shoulderL／R、armor、robe、trinket），疊在身體部件上，會改變輪廓。零件以自己的關節點對齊身體部件上的點（頭頂、髮髻、胸口、腰帶），披風有獨立骨頭，執行期隨步伐飄動。
- 2026-09-28 起髮色、新衣裝與疊加裝備改由 Codex 重畫（原本程式逐點畫的札甲、護肩太假，髮色換色會把眼睛眉毛一起染色）。提示詞在 `tools/pixelCodexJobs.json`，`python tools/pixelCodex.py tools/pixelCodexJobs.json [名稱]` 平行產圖到 `source/codex/<名稱>/out.png`（洋紅底）。`tools/pixelCodexParts.py` 去背、切件：頭、馬尾、軀幹、袖子縮到原部件外框大小並照比例換算關節點；疊加裝備依指定寬度縮圖，掛點以外框比例標定。直接執行它會輸出各表的編號預覽 `pieces.png`。
- 新版型褲子（`codex/pants2`）照骨架規格請 Codex 畫：小腿約大腿六成長、頂端沒有關節圓帽、膝蓋一律有布或護膝蓋住、褲腳收窄進靴子。第一批沒有這些限制，膝蓋露出皮膚與灰色圓帽、小腿太長把靴子蓋掉，用程式補救效果都不好。`limb_like()` 依原部件的關節距離等比縮放、旋轉到原本的斜角，小腿沿用同款大腿的比例，長度延伸到踝關節再多 4 像素。靴子插槽畫在小腿之上：待機時小腿斜向後、靴子由反解保持水平，褲腳畫在上面會斜斜地和靴口錯開，收在水平的靴口底下就沒有這個問題。靴子從原版紅綁腿的下緣裁起，窄褲管不會從兩側露出綁腿。裙褲這類兩腿連成一片的款式請做成下擺。
- 走路一步 0.8 秒取 8 段。上臂前後擺 ±20 度，前臂與手腕晚約 35 度相位跟上，往前擺時手肘多彎、往後擺時較直。空手走路時手部插槽切到 `hand<側>Relaxed`（放鬆微握），每種手型 Skin 都有這個附件，握兵器時對應回原手型。
- 跑步、跳躍、倒地：產生器 `moves()` 為每種持物方式各產生 walk／run／jump／down 四組（例如 walkSpearR、runSpearR），執行期由 `profile.walk` 換字首取得。手臂、軀幹、頭髮寫在產生器；腿與身體位移在執行期 `plantLegs()`：跑步用 `RUN` 步態（每腳著地 34%，中間有騰空期）；跳躍依 `JUMP` 蹲低、拋物線騰空、空中雙腳往上收 12 像素讓膝蓋彎起；倒地依 `DOWN` 讓根骨頭向後轉 90 度、往右挪並抬到背貼地，雙腿從反解漸變成仰躺彎膝。持兵器倒地時手甩過頭頂、兵刃平躺在地上。
- 待機只在兩個姿勢間切換（Spine stepped 曲線）：身體整數下沉 1px、馬尾與披風換一個角度，軀幹不轉。小角度連續旋轉在最近鄰取樣下會讓像素每格重排，看起來像身上有波紋。
- 換色在 `tools/pixelWardrobe.py`：依材質遮罩（HLS）挑像素，再依原本明暗套到新色階，保留像素陰影。新增色系只要加一行色階。
- 預覽頁的下拉選單直接讀骨架裡的 Skin 名稱，新增的 Skin 不用改頁面就會出現。
- `WEAPONS` 明列每種兵器的手型、待機、步行、攻擊與時長。長槍沉腰突刺、摺扇展開橫掃、飛鏢過肩擲出、拳套刺拳接直拳，各自一套動作與左手版本。
- 長槍雙手持握：左臂在執行期反解到槍桿上的扶點，手肘朝下。突刺時槍桿往前滑，前手搆不到扶點就沿槍桿往後找最遠搆得到的一點。右手失能時改左手單手持槍。
- 摺扇與飛鏢用附件軌道切換：扇子揚手時展開、收勢時收起，飛鏢出手後手中暫時沒有鏢，收勢時補回。

## 本地像素產生器

`tools/pixelgen/` 呼叫本機 ComfyUI（FLUX.2 klein 9B，參考圖編輯），以原部件表為參考產生同風格的新部件表，再去背、切格：

```sh
python tools/pixelgen/pixelgen.py generate --preset outfit-robe --count 2
python tools/pixelgen/pixelgen.py slice art/characters/pixelHeroine/source/gen/outfit-robe-0.png --grid 4x4
```

預設組在 `tools/pixelgen/presets.json`（武器、髮型、腿部、差異大的長袍）。ComfyUI 與短影音流程共用同一張顯卡，產生器會等佇列空閒一段時間才送出，輸出走暫存預覽，不寫入短影音的輸出資料夾。切好的部件要再在 `pixelHeroineParts.py` 量關節點才能上骨架。

## 限制

這是技術與造型試作，尚未替換正式遊戲角色，也尚未連接傷勢數值。旋轉部件仍看得出骨架動畫的特徵。各部位縮放倍率不同，頭部像素顆粒比四肢粗。衣裝只替換軀幹，袖子共用。沒有完整髮型、裝備庫、跛行、雙臂失能或四向探索動作。金龍沿用一代素材。

## 重建

在 repo 根目錄執行，需要 Python（Pillow、numpy）與 Node.js：

```sh
python tools/pixelHeroineParts.py   # 裁切、縮圖、打包 public 圖集、輸出關節點
node tools/buildPixelHeroine.ts     # 由關節點組骨架與動作，寫入 public 與 spine/pixel-heroine-source.json
```

要調整接縫，改 `pixelHeroineParts.py` 裡 `PARTS` 的原稿關節座標，兩個指令都重跑一次。要調整動作，改 `buildPixelHeroine.ts` 的姿勢角度，只需重跑第二個指令。

`spine/pixel-heroine-v1`～`v8.spine` 與 `source/parts.atlas` 是第一版骨架的舊檔，和目前的 JSON 不相容。要進 Spine 編輯器精修，可用 Spine CLI 匯入 `spine/pixel-heroine-source.json`，圖片路徑為 `../images/`：

```powershell
& 'C:\Program Files\Spine\Spine.com' -u 4.3.26 -i "$PWD/art/characters/pixelHeroine/spine/pixel-heroine-source.json" -o "$PWD/art/characters/pixelHeroine/spine/pixel-heroine-v9.spine" -r pixel-heroine
```

## 驗證

- `tests/pixelHeroine.test.ts` 使用真實 Spine runtime：站定動作的鞋底貼地不滑動、走路時至少一腳著地、出掌時腰部前移、兵刃換手、傷手在各動作與倒拖時間軸中維持下垂、受擊時兵刃維持架勢。
- 瀏覽器逐格截圖檢查待機、走路、出掌、劍／刀斜劈、受擊，正常與右手失能兩側都有看過。
