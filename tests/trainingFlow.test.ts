import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/game/battle';
import { createGame } from '../src/game/state';
import { SparringLesson } from '../src/game/SparringLesson';

describe('first sparring learning opportunities', () => {
  for (const route of ['sword', 'fist'] as const) {
    it(`${route}: first heavy offers defense before impact and teaches the real opening`, () => {
      const battle = new Battle(createGame('旅人', route), 'trial', () => 0.5);
      const lesson = new SparringLesson();
      battle.paused = false;
      let guarded = false;
      let taughtOpening = false;
      for (let elapsed = 0; elapsed < 60 && !battle.result; elapsed += 0.05) {
        const events = battle.update(0.05);
        const cue = lesson.next(battle, events);
        if (cue?.kind === 'defend') {
          expect(guarded).toBe(false);
          expect(battle.enemies[0].windup).toBeGreaterThan(1.5);
          expect(battle.intent(0)).toContain('重擊');
          battle.holdingPosition = true;
          expect(battle.act({ type: 'defend' })).toBeNull();
          guarded = true;
        } else if (cue?.kind === 'opening') {
          expect(guarded).toBe(true);
          expect(cue.blocked).toBeGreaterThan(cue.damage);
          expect(cue.missed).toBe(false);
          expect(battle.enemies[0].opening).toBe(true);
          expect(
            battle.act({
              type: 'skill',
              skill: route === 'sword' ? 'swordfall' : 'dragon',
              target: 0,
            }),
          ).toBeNull();
          taughtOpening = true;
        }
      }
      expect(taughtOpening).toBe(true);
      expect(battle.result).toBe('victory');
    });
    it(`${route}: basic attacks leave time to observe a heavy attack`, () => {
      const battle = new Battle(createGame('旅人', route), 'trial', () => 0.5);
      battle.paused = false;
      const events: BattleEvent[] = [];
      let seconds = 0;
      while (!battle.result && seconds < 60) {
        events.push(...battle.update(0.05));
        seconds += 0.05;
      }
      expect(battle.result).toBe('victory');
      expect(events.some((event) => event.kind === 'windup' && event.heavy)).toBe(true);
      expect(battle.player.hp).toBeGreaterThan(30);
    });
  }
  it('skipped lessons and normal encounters do not interrupt combat', () => {
    const trial = new Battle(createGame('旅人', 'sword'), 'trial');
    trial.enemies[0].actions = 1;
    trial.enemies[0].position = 12;
    trial.enemies[0].strikeRange = { min: 1, max: 3 };
    const skipped = new SparringLesson();
    skipped.skip();
    expect(skipped.next(trial, [])).toBeNull();
    const boss = new Battle(createGame('旅人', 'sword'), 'boss');
    expect(new SparringLesson().next(boss, [])).toBeNull();
  });
});
