import { ITEMS } from '../data/content';
import { isEquipped } from './equipment';
import type { GameState, ItemId } from './types';

export const BAG_CAPACITY = 100;
export const STACK_SIZE = 99;
export function bagQuantity(state: GameState, id: ItemId): number {
  return Math.max(0, state.inventory[id] - (isEquipped(state, id) ? 1 : 0));
}
export function usedBagSlots(state: GameState): number {
  return (Object.keys(ITEMS) as ItemId[]).reduce(
    (sum, id) =>
      sum +
      (ITEMS[id].kind === 'quest'
        ? 0
        : Math.ceil(bagQuantity(state, id) / (ITEMS[id].kind === 'medicine' ? STACK_SIZE : 1))),
    0,
  );
}
export function canReceiveItem(state: GameState, id: ItemId): boolean {
  if (ITEMS[id].kind === 'quest') {
    return true;
  }
  const before = usedBagSlots(state);
  const next = { ...state, inventory: { ...state.inventory, [id]: state.inventory[id] + 1 } };
  return state.inventory[id] < 999 && usedBagSlots(next) <= Math.max(BAG_CAPACITY, before);
}
