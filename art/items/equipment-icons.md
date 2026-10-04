# Equipment icon sources

The new equipment icons reuse the approved heroine rig parts in `art/characters/pixelHeroine/images/`.

- Pants: `thighR.png`, `shinR.png`, `thighR_greaves.png`, `shinR_greaves.png`. Pixi assembles the two legs at the existing hip and knee anchors in `CharacterSheet.artIcon`.
- Boots: `bootR.png`, `bootR_black.png`.
- Headwear: `hatStraw.png`, `hatCrown.png`.

The PNG files in `public/assets/icons/items/` are unchanged copies. `AssetService` loads them under item aliases. The rig uses the corresponding pants, boots and headwear skins for equipped appearance.
