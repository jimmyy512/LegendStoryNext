import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { createGame } from '../src/game/state';

function battle(route: 'sword' | 'fist' = 'sword'): Battle {
  const fight = new Battle(createGame('演武', route), 'boss', () => 0);
  fight.enemies[0].position = 12.5;
  fight.holdingPosition = true;
  return fight;
}

function strike(fight: Battle, skill?: string): void {
  fight.recovery = 0;
  fight.playerProgress = 1;
  fight.act(skill ? { type: 'skill', skill, target: 0 } : { type: 'attack', target: 0 });
  fight.update(0.05);
  for (let i = 0; fight.strike && i < 30; i++) {
    fight.update(0.05);
  }
}

describe('氣勢與追擊', () => {
  it('普攻累積氣勢，取消預約不花氣勢，爆發出手才扣除並打退蓄勢', () => {
    const fight = battle();
    for (let i = 0; i < 3; i++) {
      strike(fight);
    }
    expect(fight.momentum).toBe(3);
    fight.act({ type: 'skill', skill: 'swordfall', target: 0 });
    fight.cancelAction();
    expect(fight.momentum).toBe(3);
    fight.enemies[0].progress = 0.5;
    const mp = fight.player.mp;
    strike(fight, 'swordfall');
    expect(fight.momentum).toBe(0);
    expect(fight.player.mp).toBe(mp - 10);
    expect(fight.enemies[0].progress).toBeGreaterThan(0.2);
    expect(fight.enemies[0].progress).toBeLessThan(0.4);
    expect(fight.events.some((event) => event.text.includes('氣勢爆發'))).toBe(true);
  });

  it('成功防禦蓄勢，抱元守一保留滿氣勢，伏龍掌可用爆發', () => {
    const fight = battle('fist');
    fight.momentum = 2;
    fight.playerProgress = 1;
    fight.enemies[0].progress = 1;
    fight.act({ type: 'defend' });
    fight.update(0.6);
    expect(fight.momentum).toBe(3);
    strike(fight, 'guard');
    expect(fight.momentum).toBe(3);
    strike(fight, 'dragon');
    expect(fight.momentum).toBe(0);
  });

  it('重擊後破綻只強化一次追擊，下一次敵人出手會收回破綻', () => {
    const fight = battle();
    fight.autoAttack = false;
    fight.paused = false;
    fight.enemies[0].actions = 2;
    fight.enemies[0].progress = 1;
    fight.update(1.1);
    expect(fight.intent(0)).toContain('追擊');
    const before = fight.enemies[0].hp;
    strike(fight);
    const bonusDamage = before - fight.enemies[0].hp;
    expect(fight.enemies[0].opening).toBe(false);
    const next = fight.enemies[0].hp;
    strike(fight);
    expect(bonusDamage).toBeGreaterThan(next - fight.enemies[0].hp);
    fight.enemies[0].opening = true;
    fight.enemies[0].progress = 1;
    fight.enemies[0].recovery = 0;
    fight.update(0.6);
    expect(fight.enemies[0].opening).toBe(false);
  });

  it('出手前失去雙手或內力時保留氣勢與內力', () => {
    for (const reason of ['hands', 'mp']) {
      const fight = battle();
      fight.momentum = 3;
      fight.act({ type: 'skill', skill: 'swordfall', target: 0 });
      if (reason === 'hands') {
        fight.player.body.leftArm = fight.player.body.rightArm = 0;
      } else {
        fight.player.mp = 0;
      }
      const mp = fight.player.mp;
      fight.playerProgress = 1;
      fight.update(0.05);
      expect(fight.momentum).toBe(3);
      expect(fight.player.mp).toBe(mp);
    }
  });

  it('氣勢不超過三格，暫停不推進敵人破綻或蓄勢', () => {
    const fight = battle();
    fight.momentum = 3;
    strike(fight);
    expect(fight.momentum).toBe(3);
    fight.enemies[0].opening = true;
    fight.togglePause();
    const progress = fight.enemies[0].progress;
    fight.update(10);
    expect(fight.enemies[0].progress).toBe(progress);
    expect(fight.enemies[0].opening).toBe(true);
  });

  it('頭部重傷打斷首領蓄勢並給玩家一次追擊窗口', () => {
    const fight = battle();
    fight.autoAttack = false;
    fight.targetPart = 'head';
    fight.enemies[0].body.head = 1;
    fight.enemies[0].strikeRange = { min: 1, max: 4 };
    fight.enemies[0].windup = 1.2;
    strike(fight);
    expect(fight.enemies[0].body.head).toBe(0);
    expect(fight.enemies[0].strikeRange).toBeNull();
    expect(fight.enemies[0].recovery).toBeGreaterThan(0.5);
    expect(fight.enemies[0].opening).toBe(true);
    expect(fight.events.some((event) => event.text.includes('攻勢中斷'))).toBe(true);
  });

  it('我方頭部重傷會中斷起招', () => {
    const fight = new Battle(createGame('演武', 'sword'), 'boss', () => 0.99);
    fight.enemies[0].position = fight.playerPosition + 2.5;
    fight.player.body.head = 1;
    fight.autoAttack = false;
    fight.paused = false;
    fight.enemies[0].progress = 1;
    fight.update(0.05);
    fight.strike = {
      action: { type: 'attack', target: 0 },
      remaining: 1,
      range: { min: 1, max: 4 },
      part: 'chest',
      empowered: false,
    };
    fight.update(0.6);
    expect(fight.player.body.head).toBe(0);
    expect(fight.strike).toBeNull();
    expect(fight.recovery).toBeGreaterThan(0);
    expect(fight.events.some((event) => event.text.includes('起招中斷'))).toBe(true);
  });
});
