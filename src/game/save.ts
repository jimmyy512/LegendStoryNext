import { z } from 'zod';
import { ITEMS } from '../data/content';
import { COLS, MAPS, ROWS } from '../data/maps';
import { HAIR_STYLES } from './appearance';
import { createBody, PART_CAPACITY } from './body';
import { isWalkable, nearestWalkable } from './pathfinding';
import { getStats } from './state';
import { EQUIPMENT_SLOTS } from './equipment';
import { TALENT_IDS, availableTalentPoints } from './talents';
import type { GameState, ItemId } from './types';

const integer = z.number().int().min(0).max(999999);
const itemIds = Object.keys(ITEMS) as [ItemId, ...ItemId[]];
const schema = z
  .object({
    version: z.literal(3),
    hair: z.enum(HAIR_STYLES),
    body: z
      .object({
        head: integer.max(PART_CAPACITY.head),
        chest: integer.max(PART_CAPACITY.chest),
        abdomen: integer.max(PART_CAPACITY.abdomen),
        leftArm: integer.max(PART_CAPACITY.leftArm),
        rightArm: integer.max(PART_CAPACITY.rightArm),
        leftLeg: integer.max(PART_CAPACITY.leftLeg),
        rightLeg: integer.max(PART_CAPACITY.rightLeg),
      })
      .strict(),
    name: z.string().trim().min(1).max(12),
    route: z.enum(['sword', 'fist']),
    map: z.enum(['forest', 'temple', 'mountain', 'cave']),
    position: z.object({ x: z.number().int(), y: z.number().int() }).strict(),
    hp: integer.min(1),
    mp: integer,
    level: z.number().int().min(1).max(10),
    talents: z.array(z.enum(TALENT_IDS)).max(2).default([]),
    xp: integer,
    gold: integer,
    inventory: z.record(z.enum(itemIds), z.number().int().min(0).max(999)),
    weapon: z.enum(['sword', 'wraps']).nullable(),
    armor: z.enum(['robe', 'armor']).nullable(),
    pants: z.enum(['inkPants', 'guardPants']).nullable().default('inkPants'),
    boots: z.enum(['brownBoots', 'swiftBoots']).nullable().default('brownBoots'),
    headwear: z.enum(['strawHat', 'taoistCrown']).nullable().default(null),
    quest: z.enum([
      'arrival',
      'trial',
      'report',
      'bandits',
      'investigate',
      'boss',
      'return',
      'complete',
    ]),
    flags: z.array(z.string().max(64)).max(100),
    defeated: z.array(z.enum(['trial', 'bandits', 'patrol', 'undead', 'boss'])).max(5),
    opened: z.array(z.enum(['forest-chest', 'mountain-chest', 'cave-chest'])).max(3),
    playSeconds: integer,
    wildlife: z
      .partialRecord(
        z.enum(['wild-forest', 'wild-mountain', 'wild-cave']),
        z.object({ readyAt: integer, cycle: integer }).strict(),
      )
      .optional(),
  })
  .strict();

export interface SaveRecord {
  savedAt: string;
  state: GameState;
}
export type SaveSlot = 'manual' | 'auto';

export function decodeSave(raw: string): SaveRecord {
  if (raw.length > 100000) {
    throw new Error('存檔檔案過大。');
  }
  const input: unknown = JSON.parse(raw);
  // Additive equipment migration preserves all existing quantities and worn appearances.
  if (input && typeof input === 'object' && 'state' in input) {
    const source = input.state;
    if (
      source &&
      typeof source === 'object' &&
      'inventory' in source &&
      source.inventory &&
      typeof source.inventory === 'object' &&
      !Array.isArray(source.inventory)
    ) {
      const oldEquipment = !('pants' in source) && !('boots' in source) && !('headwear' in source);
      if (oldEquipment) {
        const hat = 'hair' in source && source.hair === 'Hair4';
        if (hat && 'hair' in source) {
          source.hair = 'Hair1';
        }
        source.inventory = {
          inkPants: 1,
          guardPants: 0,
          brownBoots: 1,
          swiftBoots: 0,
          strawHat: hat ? 1 : 0,
          taoistCrown: 0,
          ...source.inventory,
        };
        Object.assign(source, {
          pants: 'inkPants',
          boots: 'brownBoots',
          headwear: hat ? 'strawHat' : null,
        });
      }
    }
  }
  const legacy = z
    .object({
      savedAt: z.string().datetime(),
      state: schema
        .omit({ body: true, version: true, hair: true })
        .extend({ version: z.literal(1) })
        .strict(),
    })
    .strict()
    .safeParse(input);
  const previous = z
    .object({
      savedAt: z.string().datetime(),
      state: schema
        .omit({ version: true, hair: true })
        .extend({ version: z.literal(2) })
        .strict(),
    })
    .strict()
    .safeParse(input);
  const migrated = legacy.success
    ? {
        savedAt: legacy.data.savedAt,
        state: { ...legacy.data.state, version: 3, hair: 'Hair1', body: createBody() },
      }
    : previous.success
      ? {
          savedAt: previous.data.savedAt,
          state: { ...previous.data.state, version: 3, hair: 'Hair1' },
        }
      : input;
  const envelope = z
    .object({ savedAt: z.string().datetime(), state: schema })
    .strict()
    .safeParse(migrated);
  if (!envelope.success) {
    throw new Error('存檔格式不正確，或版本不受支援。');
  }
  const record = envelope.data;
  const state = record.state;
  if (availableTalentPoints(state) < 0 || new Set(state.talents).size !== state.talents.length) {
    throw new Error('存檔的天賦點數不正確。');
  }
  const stats = getStats(state);
  // Earlier temple saves used block rectangles and could stop on painted walls.
  // Migrate only those formerly valid tiles, before the current walkability check.
  const { x, y } = state.position;
  // Forest v1 used coarse block rectangles and let heroes stand on painted foliage.
  if (
    state.map === 'forest' &&
    !isWalkable(MAPS.forest, state.position) &&
    x > 0 &&
    x < COLS - 1 &&
    y > 0 &&
    y < ROWS - 1 &&
    !MAPS.forest.blocks.some(
      (block) => x >= block.x && x < block.x + block.w && y >= block.y && y < block.y + block.h,
    )
  ) {
    state.position = nearestWalkable(MAPS.forest, state.position);
  }
  if (
    state.map === 'temple' &&
    !isWalkable(MAPS.temple, state.position) &&
    x > 0 &&
    x < COLS - 1 &&
    y > 0 &&
    y < ROWS - 1 &&
    !MAPS.temple.blocks.some(
      (block) => x >= block.x && x < block.x + block.w && y >= block.y && y < block.y + block.h,
    )
  ) {
    state.position = nearestWalkable(MAPS.temple, state.position);
  }
  // The old mountain path included the trees below its western bend.
  if (
    state.map === 'mountain' &&
    ((y === 6 && x >= 3 && x <= 5) || (y === 7 && x >= 5 && x <= 9))
  ) {
    state.position = nearestWalkable(MAPS.mountain, state.position);
  }
  // Cave v1 allowed walking across the central ridge and the northeastern rocks.
  // Repair only tiles accepted by that version, not arbitrary invalid locations.
  const oldCaveRows: Record<number, [number, number]> = {
    1: [19, 22],
    2: [17, 22],
    3: [16, 22],
    4: [14, 22],
    5: [13, 21],
    6: [14, 19],
    7: [7, 15],
    8: [6, 13],
    9: [5, 8],
    10: [4, 8],
    11: [2, 8],
    12: [2, 7],
    13: [2, 5],
  };
  const oldCaveRow = oldCaveRows[y];
  if (
    state.map === 'cave' &&
    !isWalkable(MAPS.cave, state.position) &&
    oldCaveRow &&
    x >= oldCaveRow[0] &&
    x <= oldCaveRow[1]
  ) {
    state.position = nearestWalkable(MAPS.cave, state.position);
  }
  if (
    !isWalkable(MAPS[state.map], state.position) ||
    state.hp > stats.maxHp ||
    state.mp > stats.maxMp
  ) {
    throw new Error('存檔的位置或角色能力不正確。');
  }
  if (
    state.weapon &&
    (state.inventory[state.weapon] < 1 || (state.route === 'sword') !== (state.weapon === 'sword'))
  ) {
    throw new Error('存檔的武器資料不正確。');
  }
  if (EQUIPMENT_SLOTS.some((slot) => state[slot] && state.inventory[state[slot]!] < 1)) {
    throw new Error('存檔的裝備資料不正確。');
  }
  if (
    [state.flags, state.defeated, state.opened].some(
      (entries) => new Set(entries).size !== entries.length,
    )
  ) {
    throw new Error('存檔含有重複進度。');
  }
  return record;
}

export function encodeSave(state: GameState): string {
  const raw = JSON.stringify({ savedAt: new Date().toISOString(), state });
  decodeSave(raw);
  return raw;
}
