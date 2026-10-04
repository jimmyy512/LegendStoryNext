import type { Battle } from './battle';
import { createGame, restore } from './state';
import { EQUIPMENT_ITEMS } from './equipment';
import type { Route } from './types';

export const PREVIEW_LEVEL = 10;

export function createCombatPreview(route: Route, chapterBoss = false) {
  const state = createGame(chapterBoss ? '驗收俠客' : '演武俠客', route);
  state.level = chapterBoss ? 3 : PREVIEW_LEVEL;
  state.weapon = route === 'sword' ? 'sword' : 'wraps';
  state.armor = 'robe';
  if (!chapterBoss) {
    for (const id of Object.values(EQUIPMENT_ITEMS).flat()) {
      state.inventory[id] = 1;
    }
  } else {
    state.inventory[state.weapon] = 1;
    state.inventory.robe = 1;
  }
  restore(state);
  return state;
}

/** 演武對手偏重耐力成長，讓走位、破招與傷勢有時間發揮。 */
export function prepareCombatPreview(battle: Battle): void {
  const growth = PREVIEW_LEVEL - 1;
  for (const enemy of battle.enemies) {
    enemy.level = PREVIEW_LEVEL;
    enemy.stats = {
      ...enemy.stats,
      maxHp: enemy.stats.maxHp + growth * 40,
      attack: enemy.stats.attack + growth * 2,
      defense: enemy.stats.defense + growth * 2,
      speed: enemy.stats.speed + growth * 0.5,
    };
    enemy.hp = enemy.stats.maxHp;
  }
}
