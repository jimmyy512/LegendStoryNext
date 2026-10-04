import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { createGame } from '../src/game/state';

function prepared(encounter: string, heavyActions: number): Battle {
  const battle = new Battle(createGame('演武', 'sword'), encounter, () => 0);
  battle.paused = false;
  battle.autoAttack = false;
  battle.holdingPosition = true;
  battle.enemies[0].position = 13;
  battle.enemies[0].actions = heavyActions;
  battle.enemies[0].progress = 1;
  return battle;
}

describe('敵人招式差異', () => {
  it('山道刀客的橫掃明示腿部威脅，命中腿部', () => {
    const battle = prepared('patrol', 2);
    const tell = battle.update(0.1);
    expect(tell.some((event) => event.move === '斷腿橫掃' && event.kind === 'windup')).toBe(true);
    const hit = battle
      .update(1.2)
      .find((event) => event.kind === 'damage' && event.target === 'player');
    expect(hit?.part).toBe('leftLeg');
  });

  it('失心傀儡會纏住手臂並消耗腳力', () => {
    const battle = prepared('undead', 1);
    battle.update(0.1);
    const before = battle.stamina;
    const events = battle.update(1.5);
    expect(events.find((event) => event.kind === 'damage' && event.target === 'player')?.part).toBe(
      'leftArm',
    );
    expect(battle.stamina).toBeLessThan(before);
  });

  it('首領受傷後的危險招式會改名提示', () => {
    const battle = prepared('boss', 2);
    battle.enemies[0].hp = battle.enemies[0].stats.maxHp / 2;
    expect(battle.intent(0)).toContain('焚心劍・絕境');
  });
});
