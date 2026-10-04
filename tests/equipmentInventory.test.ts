import { describe, expect, it } from 'vitest';
import { createGame, equip, getStats, unequip, sell } from '../src/game/state';
import { decodeSave, encodeSave } from '../src/game/save';

describe('equipment remains owned while changing worn slots', () => {
  it('changes five independent slots and preserves ownership through save reload', () => {
    const state = createGame('旅人', 'sword');
    const base = getStats(state);
    for (const id of ['sword', 'robe', 'guardPants', 'swiftBoots', 'taoistCrown'] as const) {
      state.inventory[id] = 1;
      expect(equip(state, id)).toBe(true);
      expect(sell(state, id)).toBe(false);
    }
    expect(getStats(state)).toMatchObject({
      attack: base.attack + 6,
      defense: base.defense + 5,
      speed: base.speed + 1,
    });
    const restored = decodeSave(encodeSave(state)).state;
    expect(restored).toEqual(state);
    expect(unequip(restored, 'guardPants')).toBe(true);
    expect(restored.pants).toBeNull();
    expect(restored.armor).toBe('robe');
    expect(restored.boots).toBe('swiftBoots');
    expect(restored.inventory.guardPants).toBe(1);
    expect(getStats(restored).defense).toBe(base.defense + 3);
  });
  it('migrates old clothing and hat appearance without losing prior items', () => {
    const old = JSON.parse(encodeSave(createGame('旅人', 'sword')));
    delete old.state.pants;
    delete old.state.boots;
    delete old.state.headwear;
    for (const id of [
      'inkPants',
      'guardPants',
      'brownBoots',
      'swiftBoots',
      'strawHat',
      'taoistCrown',
    ]) {
      delete old.state.inventory[id];
    }
    old.state.hair = 'Hair4';
    const migrated = decodeSave(JSON.stringify(old)).state;
    expect(migrated.headwear).toBe('strawHat');
    expect(migrated.inventory.strawHat).toBe(1);
    expect(migrated.inventory.herb).toBe(3);
    expect(migrated.pants).toBe('inkPants');
    expect(decodeSave(encodeSave(migrated)).state).toEqual(migrated);
  });
  it('removes only the worn bonus and can equip the same item again', () => {
    const state = createGame('旅人', 'sword');
    state.inventory.robe = 1;
    const base = getStats(state).defense;
    expect(equip(state, 'robe')).toBe(true);
    expect(getStats(state).defense).toBeGreaterThan(base);
    expect(unequip(state, 'robe')).toBe(true);
    expect(state.inventory.robe).toBe(1);
    expect(getStats(state).defense).toBe(base);
    expect(unequip(state, 'robe')).toBe(false);
    expect(equip(state, 'robe')).toBe(true);
  });
});
