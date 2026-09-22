import { ITEMS } from '../data/content';
import { createBody } from './body';
import type { GameState, ItemId, Route, Stats } from './types';

export function createGame(name: string, route: Route): GameState {
  const state: GameState = {
    version: 3,
    hair: 'Hair1',
    body: createBody(),
    name: name.trim().slice(0, 12) || '無名',
    route,
    map: 'forest',
    position: { x: 3, y: 7 },
    hp: 1,
    mp: 1,
    level: 1,
    xp: 0,
    gold: 35,
    inventory: Object.fromEntries(Object.keys(ITEMS).map((id) => [id, 0])) as Record<
      ItemId,
      number
    >,
    weapon: null,
    armor: null,
    quest: 'arrival',
    flags: [],
    defeated: [],
    opened: [],
    playSeconds: 0,
  };
  state.inventory.herb = 3;
  state.inventory.tonic = 2;
  restore(state);
  return state;
}

export function getStats(state: GameState): Stats {
  const growth = state.level - 1;
  return {
    maxHp: 100 + growth * 20 + (state.route === 'fist' ? 15 : 0),
    maxMp: 35 + growth * 5,
    attack:
      17 +
      growth * 3 +
      (state.route === 'sword' ? 2 : 0) +
      (state.weapon ? (ITEMS[state.weapon].attack ?? 0) : 0),
    defense:
      5 +
      growth * 2 +
      (state.route === 'fist' ? 2 : 0) +
      (state.armor ? (ITEMS[state.armor].defense ?? 0) : 0),
    speed: 8 + growth + (state.route === 'sword' ? 2 : 0),
  };
}

export function restore(state: GameState, healBody = true): void {
  const stats = getStats(state);
  state.hp = stats.maxHp;
  state.mp = stats.maxMp;
  if (healBody) {
    state.body = createBody();
  }
}

export function setFlag(state: GameState, flag: string): boolean {
  if (state.flags.includes(flag)) {
    return false;
  }
  state.flags.push(flag);
  return true;
}

export function gainExperience(state: GameState, amount: number): number {
  state.xp += amount;
  let gained = 0;
  while (state.level < 10 && state.xp >= state.level * 60) {
    state.xp -= state.level * 60;
    state.level++;
    gained++;
  }
  if (gained > 0) {
    restore(state, false);
  }
  return gained;
}

export function useMedicine(state: GameState, id: ItemId): boolean {
  const item = ITEMS[id];
  if (item.kind !== 'medicine' || state.inventory[id] <= 0) {
    return false;
  }
  const stats = getStats(state);
  if ((!item.hp || state.hp >= stats.maxHp) && (!item.mp || state.mp >= stats.maxMp)) {
    return false;
  }
  state.inventory[id]--;
  state.hp = Math.min(stats.maxHp, state.hp + (item.hp ?? 0));
  state.mp = Math.min(stats.maxMp, state.mp + (item.mp ?? 0));
  return true;
}

export function equip(state: GameState, id: ItemId): boolean {
  if (state.inventory[id] <= 0) {
    return false;
  }
  if (id === 'sword' || id === 'wraps') {
    if ((state.route === 'sword') !== (id === 'sword')) {
      return false;
    }
    state.weapon = id;
    return true;
  }
  if (id === 'robe' || id === 'armor') {
    state.armor = id;
    return true;
  }
  return false;
}

export function buy(state: GameState, id: ItemId): boolean {
  const item = ITEMS[id];
  if (
    item.price <= 0 ||
    item.kind === 'quest' ||
    state.gold < item.price ||
    state.inventory[id] >= 99
  ) {
    return false;
  }
  state.gold -= item.price;
  state.inventory[id]++;
  return true;
}

export function sell(state: GameState, id: ItemId): boolean {
  const item = ITEMS[id];
  if (item.kind === 'quest' || state.inventory[id] <= 0) {
    return false;
  }
  if ((state.weapon === id || state.armor === id) && state.inventory[id] <= 1) {
    return false;
  }
  state.inventory[id]--;
  state.gold += Math.floor(item.price / 2);
  return true;
}
