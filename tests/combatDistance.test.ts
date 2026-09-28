import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { createGame } from '../src/game/state';

function duel(): Battle {
  const battle = new Battle(createGame('演武', 'sword'), 'boss', () => 0);
  battle.autoAttack = false;
  battle.paused = false;
  return battle;
}

describe('距離交鋒', () => {
  it('雙方實際移動，選目標不重設任何人的位置', () => {
    const battle = new Battle(createGame('演武', 'fist'), 'bandits', () => 0);
    battle.paused = false;
    const positions = [battle.playerPosition, ...battle.enemies.map((enemy) => enemy.position)];
    battle.update(0.5);
    expect(battle.playerPosition).toBeGreaterThan(positions[0]);
    expect(battle.enemies[0].position).toBeLessThan(positions[1]);
    const before = battle.enemies.map((enemy) => enemy.position);
    battle.act({ type: 'attack', target: 1 });
    expect(battle.enemies.map((enemy) => enemy.position)).toEqual(before);
    expect(battle.distance(0)).not.toBe(battle.distance(1));
  });

  it('射程外保留預約，進入射程才扣內力開始起招，取消不能撤銷已起招的攻擊', () => {
    const battle = duel();
    battle.holdingPosition = true;
    battle.enemies[0].body.leftLeg = battle.enemies[0].body.rightLeg = 0;
    battle.playerProgress = 1;
    battle.act({ type: 'skill', skill: 'swordfall', target: 0 });
    battle.update(0.1);
    expect(battle.player.mp).toBe(35);
    expect(battle.strike).toBeNull();
    expect(battle.enemies[0].hp).toBe(180);
    battle.enemies[0].position = 14;
    battle.update(0.05);
    expect(battle.strike).not.toBeNull();
    expect(battle.player.mp).toBe(25);
    battle.cancelAction();
    expect(battle.strike).not.toBeNull();
    battle.update(0.7);
    expect(battle.enemies[0].hp).toBeLessThan(180);
    expect(battle.recovery).toBeGreaterThan(0);
  });

  it('起招後目標退出射程會落空，不造成傷勢或累積氣勢', () => {
    const battle = duel();
    battle.enemies[0].position = 14;
    battle.holdingPosition = true;
    battle.playerProgress = 1;
    battle.act({ type: 'attack', target: 0 });
    battle.update(0.05);
    expect(battle.strike).not.toBeNull();
    battle.enemies[0].position = 19;
    const events = battle.update(0.5);
    expect(events.some((event) => event.kind === 'miss')).toBe(true);
    expect(battle.enemies[0].hp).toBe(180);
    expect(battle.momentum).toBe(0);
  });

  it('玩家能在敵人重擊前搖時拉開並躲掉攻擊', () => {
    const battle = duel();
    battle.enemies[0].position = 14.6;
    battle.enemies[0].actions = 2;
    battle.enemies[0].progress = 1;
    battle.holdingPosition = true;
    battle.update(0.05);
    expect(battle.enemies[0].strikeRange).not.toBeNull();
    battle.setDistance(9);
    const events = battle.update(1.05);
    expect(battle.distance()).toBeGreaterThan(5);
    expect(battle.player.hp).toBe(100);
    expect(events.some((event) => event.kind === 'miss' && event.source === 0)).toBe(true);
  });

  it('腿傷降低真實位移，腳力耗盡後需要恢復，停步不會跟著敵人走', () => {
    const healthy = duel();
    const injured = duel();
    injured.player.body.rightLeg = 0;
    healthy.setDistance(9);
    injured.setDistance(9);
    healthy.update(0.5);
    injured.update(0.5);
    expect(10 - injured.playerPosition).toBeCloseTo((10 - healthy.playerPosition) * 0.55);
    healthy.stamina = 0;
    const position = healthy.playerPosition;
    healthy.update(0.5);
    expect(healthy.playerPosition).toBe(position);
    expect(healthy.stamina).toBeGreaterThan(0);
    healthy.holdingPosition = true;
    healthy.update(2);
    expect(healthy.playerPosition).toBe(position);
  });

  it('暫停凍結移動與前搖，已起招的部位不隨 UI 選擇改變', () => {
    const battle = duel();
    battle.enemies[0].position = 14;
    battle.targetPart = 'leftArm';
    battle.playerProgress = 1;
    battle.act({ type: 'attack', target: 0 });
    battle.update(0.05);
    const snapshot = JSON.stringify([
      battle.strike,
      battle.playerPosition,
      battle.enemies,
      battle.stamina,
    ]);
    battle.togglePause();
    battle.update(20);
    expect(
      JSON.stringify([battle.strike, battle.playerPosition, battle.enemies, battle.stamina]),
    ).toBe(snapshot);
    battle.targetPart = 'rightLeg';
    battle.togglePause();
    battle.update(0.5);
    expect(battle.enemies[0].body.leftArm).toBeLessThan(32);
    expect(battle.enemies[0].body.rightLeg).toBe(40);
  });
});
