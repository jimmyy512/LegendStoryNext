import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { findPath, isWalkable } from '../src/game/pathfinding';
import { createGame } from '../src/game/state';
import { decodeSave } from '../src/game/save';

describe('松風林畫面道路', () => {
  it('山門、箱子、山賊、酒壺與刀客都由平地相連', () => {
    const start = { x: 3, y: 7 };
    for (const entity of MAPS.forest.entities) {
      expect(isWalkable(MAPS.forest, entity)).toBe(true);
      expect(findPath(MAPS.forest, start, entity).length).toBeGreaterThan(0);
    }
    const patrol = MAPS.forest.entities.find((e) => e.id === 'patrol')!;
    const path = findPath(MAPS.forest, { x: 21, y: 7 }, patrol);
    expect(path).toContainEqual({ x: 8, y: 9 });
    expect(path).toContainEqual({ x: 8, y: 10 });
  });

  it('南側樹叢與中央岩柱不可通行，舊合法位置可安全遷移', () => {
    for (const position of [
      { x: 17, y: 9 },
      { x: 9, y: 11 },
      { x: 8, y: 12 },
    ]) {
      expect(isWalkable(MAPS.forest, position)).toBe(false);
      const state = createGame('回山', 'sword');
      state.position = position;
      const restored = decodeSave(
        JSON.stringify({ savedAt: new Date().toISOString(), state }),
      ).state;
      expect(isWalkable(MAPS.forest, restored.position)).toBe(true);
      expect(findPath(MAPS.forest, restored.position, { x: 22, y: 7 }).length).toBeGreaterThan(0);
      expect({ ...restored, position }).toEqual(state);
    }
  });
});
