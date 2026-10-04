import { getStats } from './state';
import type { GameState, Route } from './types';

export const CROSS_TRAINED = 'martial-cross-trained';
export const ROUTE_NAMES = { sword: '劍法', fist: '拳掌' } as const;

export function canStudyMartialArt(state: GameState): boolean {
  return (
    !['arrival', 'trial', 'report'].includes(state.quest) && !state.flags.includes(CROSS_TRAINED)
  );
}

export function studyMartialArt(state: GameState): boolean {
  if (state.map !== 'temple' || !canStudyMartialArt(state)) {
    return false;
  }
  state.flags.push(CROSS_TRAINED);
  const weapon = state.route === 'sword' ? 'wraps' : 'sword';
  // 師兄補齊練習兵器，已有的不重複贈送。
  state.inventory[weapon] = Math.max(1, state.inventory[weapon]);
  return true;
}

export function changeMartialArt(state: GameState, route: string): boolean {
  if (
    !['sword', 'fist'].includes(route) ||
    route === state.route ||
    !state.flags.includes(CROSS_TRAINED)
  ) {
    return false;
  }
  state.route = route as Route;
  const weapon = route === 'sword' ? 'sword' : 'wraps';
  state.weapon = state.inventory[weapon] > 0 ? weapon : null;
  const stats = getStats(state);
  // 切換不治療，較低生命上限只截斷超出的數值。
  state.hp = Math.min(state.hp, stats.maxHp);
  state.mp = Math.min(state.mp, stats.maxMp);
  return true;
}
