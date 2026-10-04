import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { Battle } from '../src/game/battle';
import { battleOutcome } from '../src/game/battleOutcome';
import { canReceiveItem, usedBagSlots } from '../src/game/inventory';
import { isWalkable } from '../src/game/pathfinding';
import { decodeSave, encodeSave } from '../src/game/save';
import { buy, createGame, sell, unequip } from '../src/game/state';
import { isEntityVisible, settleBattle } from '../src/game/story';
import { WILDLIFE, wildlifeReady } from '../src/game/wildlife';

describe('repeatable wilderness encounters', () => {
  it('keeps the preview reward stable and awards each spawn only once', () => {
    const state = createGame('試玩', 'sword');
    const battle = new Battle(state, 'wild-forest', () => 0);
    battle.result = 'victory';
    const summary = battleOutcome(battle);
    expect(battleOutcome(battle)).toEqual(summary);
    expect(summary.loot).toContain('劍');
    settleBattle(state, battle);
    expect(state.inventory.sword).toBe(1);
    const awarded = structuredClone(state);
    settleBattle(state, battle);
    expect(state).toEqual(awarded);
    expect(wildlifeReady(state, 'wild-forest')).toBe(false);
    const loaded = decodeSave(encodeSave(state)).state;
    expect(loaded.wildlife).toEqual(state.wildlife);
    loaded.playSeconds += 120;
    expect(wildlifeReady(loaded, 'wild-forest')).toBe(true);
    const second = new Battle(loaded, 'wild-forest', () => 0);
    second.result = 'victory';
    settleBattle(loaded, second);
    expect(loaded.inventory.sword).toBe(2);
    expect(loaded.wildlife?.['wild-forest'].cycle).toBe(2);
    expect(loaded.defeated).not.toContain('wild-forest');
  });
  it('places all respawns on reachable ground and keeps a trading NPC in the settlement', () => {
    const state = createGame('試玩', 'sword');
    for (const [id, wild] of Object.entries(WILDLIFE)) {
      const entity = MAPS[wild.map].entities.find((e) => e.encounter === id)!;
      expect(isWalkable(MAPS[wild.map], entity), id).toBe(true);
      expect(isEntityVisible(state, entity)).toBe(true);
      state.wildlife = { [id]: { readyAt: 100, cycle: 1 } };
      expect(isEntityVisible(state, entity)).toBe(false);
    }
    for (const map of Object.values(MAPS).filter((map) => map.settlement)) {
      expect(
        map.entities.some((entity) => entity.merchant),
        map.name,
      ).toBe(true);
    }
  });
  it('rolls no rewards for retreat and does not start a respawn timer', () => {
    const state = createGame('試玩', 'sword');
    const battle = new Battle(state, 'wild-forest', () => 0);
    battle.result = 'escaped';
    settleBattle(state, battle);
    expect(state.inventory.sword).toBe(0);
    expect(state.wildlife).toBeUndefined();
  });
});

describe('100-slot bag', () => {
  it('counts gear individually, stacks medicine, and preserves worn and quest items', () => {
    const state = createGame('試玩', 'sword');
    state.gold = 10000;
    state.inventory.sword = 98;
    state.inventory.journal = 1;
    expect(usedBagSlots(state)).toBe(100);
    expect(buy(state, 'robe')).toBe(false);
    expect(buy(state, 'herb')).toBe(true);
    expect(unequip(state, 'inkPants')).toBe(false);
    expect(sell(state, 'inkPants')).toBe(false);
    expect(sell(state, 'sword')).toBe(true);
    expect(buy(state, 'robe')).toBe(true);
    state.inventory.herb = 99;
    expect(canReceiveItem(state, 'herb')).toBe(false);
    expect(canReceiveItem(state, 'journal')).toBe(true);
  });
  it('converts full-bag loot at the selling price without deleting existing equipment', () => {
    const state = createGame('試玩', 'sword');
    state.inventory.sword = 98;
    const battle = new Battle(state, 'wild-forest', () => 0);
    battle.result = 'victory';
    expect(settleBattle(state, battle)).toContain('行囊已滿');
    expect(state.inventory.sword).toBe(98);
    expect(state.gold).toBeGreaterThan(35 + battle.reward.gold);
  });
});
