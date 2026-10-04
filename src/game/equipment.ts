import type { GameState, ItemId } from './types';

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'pants', 'boots', 'headwear'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export const SLOT_NAMES: Record<EquipmentSlot, string> = {
  weapon: '武器',
  armor: '上衣',
  pants: '褲子',
  boots: '鞋子',
  headwear: '頭部飾品',
};
export const EQUIPMENT_ITEMS = {
  weapon: ['sword', 'wraps'],
  armor: ['robe', 'armor'],
  pants: ['inkPants', 'guardPants'],
  boots: ['brownBoots', 'swiftBoots'],
  headwear: ['strawHat', 'taoistCrown'],
} as const;
export function equipmentSlot(id: ItemId): EquipmentSlot | undefined {
  return EQUIPMENT_SLOTS.find((slot) => (EQUIPMENT_ITEMS[slot] as readonly string[]).includes(id));
}
export function isEquipped(state: GameState, id: ItemId): boolean {
  return EQUIPMENT_SLOTS.some((slot) => state[slot] === id);
}
export function equippedItems(state: GameState): ItemId[] {
  return EQUIPMENT_SLOTS.map((slot) => state[slot]).filter(
    (id): id is NonNullable<typeof id> => !!id,
  );
}
