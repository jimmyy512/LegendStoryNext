# Companion world sprites v2

- Built-in imagegen made a 3-column, 2-row 1536×1024 RGBA atlas from the approved three companion portraits and the existing Xu Changqing pixel world sprite reference. All characters are adults; physician jade/ivory, thief rust/black, musician indigo/ivory. Row one stands; row two uses a small conversational gesture.
- Source: `C:/Users/jimmy/.codex/generated_images/01a100b6-e115-7311-bb60-c900661711ce/exec-a6fe1f57-d193-455e-a285-50bf809704fe.png`. This second imagegen pass requested removal of diffuse backdrop and preservation of identity. Faint translucent pixels remain around the silhouettes; native texture frames exclude most external padding.
- Source copy `source/world-v2.png` and runtime `public/assets/characters/companions/world-v2.png` are unchanged original bitmaps. Only native Pixi JSON texture metadata supplies frames, shared source size and consistent torso registration between gestures. No raster edit or alpha cleanup was applied.
- Six aliases: `npc:chance-qinglan`, `npc:chance-tangwan`, `npc:chance-suyin`, plus each `:gesture`. World height matches the existing NPC convention of 62 world units. Shoes and torso share frame registration; future walking and combat need authored additional poses or rig parts.
- These are standing and interaction frames, not a completed locomotion rig or companion combat system.
