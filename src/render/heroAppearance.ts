import type { GameState } from '../game/types';
import type { LegacyAppearance } from './LegacyHero';

export const HERO_ASSETS = { skeleton: 'hero:skeleton', atlas: 'hero:atlas' };

/** 外觀跟已裝備物品走，不用武學路線猜測玩家是否持劍。 */
export function heroAppearance(
  state: Pick<GameState, 'weapon' | 'armor' | 'hair'>,
): LegacyAppearance {
  return {
    outfit: state.armor === 'robe' ? 'quanzhen' : state.armor === 'armor' ? 'blue' : 'farmer',
    hair: state.hair,
    weapon: state.weapon === 'sword' ? 'Sword' : 'none',
  };
}
