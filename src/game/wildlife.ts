import type { GameState, ItemId, MapId } from './types';

export const WILDLIFE: Record<string, { map: MapId; seconds: number; drops: ItemId[] }> = {
  'wild-forest': {
    map: 'forest',
    seconds: 120,
    drops: ['sword', 'wraps', 'inkPants', 'brownBoots', 'strawHat'],
  },
  'wild-mountain': {
    map: 'mountain',
    seconds: 150,
    drops: ['robe', 'guardPants', 'swiftBoots', 'sword', 'wraps'],
  },
  'wild-cave': {
    map: 'cave',
    seconds: 180,
    drops: ['armor', 'guardPants', 'taoistCrown', 'swiftBoots'],
  },
};
export function wildlifeReady(state: GameState, id: string): boolean {
  return !WILDLIFE[id] || (state.wildlife?.[id]?.readyAt ?? 0) <= state.playSeconds;
}
export function wildlifeCycle(state: GameState, id: string): number {
  return state.wildlife?.[id]?.cycle ?? 0;
}
