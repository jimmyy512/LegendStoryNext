import { z } from 'zod';
import { ITEMS } from '../data/content';
import { MAPS } from '../data/maps';
import { HAIR_STYLES } from './appearance';
import { createBody, PART_CAPACITY } from './body';
import { isWalkable } from './pathfinding';
import { getStats } from './state';
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
    xp: integer,
    gold: integer,
    inventory: z.record(z.enum(itemIds), z.number().int().min(0).max(999)),
    weapon: z.enum(['sword', 'wraps']).nullable(),
    armor: z.enum(['robe', 'armor']).nullable(),
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
  const stats = getStats(state);
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
  if (state.armor && state.inventory[state.armor] < 1) {
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
