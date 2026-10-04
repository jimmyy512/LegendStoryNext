# 第一章門派角色

`source/*.png` 是 AI 生成的透明像素角色原稿；`public/assets/characters/npcs/*.webp` 是壓縮後的遊戲素材。所有角色以試招弟子圖作為像素風格參考，使用共同提示詞 `full-body chibi 16-bit wuxia RPG sprite, around four heads tall, three-quarter view facing left, crisp clustered pixel art, limited flat palette, transparent background, no text`，再依下表指定外觀與道具。

| 檔案 | 角色提示 |
|---|---|
| `master.png` | 上真道長；白髮頂髻、短白鬚、青白道袍、雙手從容。 |
| `qing.png` | 徐長卿；年輕師兄、黑髮馬尾、青白道袍、背負木劍、伸手迎人。 |
| `yin.png` | 蘇長胤；寡言藥師、低馬尾、灰綠道袍、藥籃。 |
| `fong.png` | 王長風；爽朗弟子、橘色外衫、短棍扛肩。 |
| `wo.png` | 陳長悟；嚴肅書生、紫灰道袍、手持竹簡。 |

`*-gesture.png` 以同名站姿為編修目標，保留角色身份和道具，分別製作道長招手、師兄揮手、藥師看藥草、弟子換握木棍、書生讀卷軸的姿勢。地圖上按角色節奏切換，互動時也會觸發。松風林受傷山賊使用敵人刀客圖並加上受傷色調。
