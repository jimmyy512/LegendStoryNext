import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { createGame } from '../src/game/state';

describe('group attack tells', () => {
  it('separates ready opponents while preserving both attacks and full windups', () => {
    const battle = new Battle(createGame('演武', 'sword'), 'bandits', () => 0);
    battle.paused = false;
    battle.autoAttack = false;
    battle.holdingPosition = true;
    battle.enemies.forEach((enemy) => {
      enemy.position = 13;
      enemy.progress = 1;
    });
    const tells: { source: unknown; time: number }[] = [];
    const hits: { source: unknown; time: number }[] = [];
    for (let step = 1; step <= 150; step++) {
      for (const event of battle.update(0.01)) {
        if (event.kind === 'windup') {
          tells.push({ source: event.source, time: step / 100 });
        }
        if (event.kind === 'damage' && event.target === 'player') {
          hits.push({ source: event.source, time: step / 100 });
        }
      }
      if (step === 10) {
        battle.paused = true;
        expect(battle.update(10)).toEqual([]);
        battle.paused = false;
      }
    }
    expect(tells.map((tell) => tell.source)).toEqual([0, 1]);
    expect(tells[1].time - tells[0].time).toBeGreaterThanOrEqual(0.64);
    expect(hits.map((hit) => hit.source)).toEqual([0, 1]);
    hits.forEach((hit, index) => {
      expect(hit.time - tells[index].time).toBeGreaterThanOrEqual(0.49);
    });
  });
});
