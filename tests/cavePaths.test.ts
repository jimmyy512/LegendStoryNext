import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { findPath, isWalkable } from '../src/game/pathfinding';
import { GameSession } from '../src/game/GameSession';
import { createGame } from '../src/game/state';

describe('藏霧洞右下方畫出的岔路', () => {
  it('does not trap an early save inside a restricted area on the way out', () => {
    const state = createGame('旅人', 'sword');
    state.map = 'cave';
    const session = new GameSession();
    session.start(state);
    const exit = MAPS.cave.entities.find((entity) => entity.kind === 'portal')!;
    const returned = session.prepareTravel(exit);
    expect(returned.map).toBe('mountain');
    session.start(returned);
    expect(() =>
      session.prepareTravel(MAPS.mountain.entities.find((entity) => entity.to === 'cave')!),
    ).toThrow('禁地');
  });
  it('allows the painted branch from the junction through to the screen edge', () => {
    const route = findPath(MAPS.cave, { x: 12, y: 7 }, { x: 21, y: 14 });
    expect(route.length).toBeGreaterThan(0);
    expect(route.every((point) => isWalkable(MAPS.cave, point))).toBe(true);
    expect(route.some((point) => point.x === 13 && point.y === 10)).toBe(true);
  });
  it('keeps the water, ridge and space beyond the map blocked', () => {
    for (const point of [
      { x: 18, y: 10 },
      { x: 10, y: 12 },
      { x: 23, y: 12 },
      { x: 21, y: 15 },
    ]) {
      expect(isWalkable(MAPS.cave, point)).toBe(false);
    }
  });
});
