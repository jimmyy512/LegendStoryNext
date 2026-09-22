import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { createBody, damagePart, limbPower, mobility, movementRate } from '../src/game/body';
import { decodeSave, encodeSave } from '../src/game/save';
import { createGame, gainExperience, restore, useMedicine } from '../src/game/state';
import { settleBattle } from '../src/game/story';

describe('部位能力', () => {
  it('右手失能不影響單手招式，雙手招式減半，雙手失能不能用手招', () => {
    const body = createBody();
    damagePart(body, 'rightArm', 100);
    expect(limbPower(body, { hands: 1, legs: 0 })).toBe(1);
    expect(limbPower(body, { hands: 2, legs: 0 })).toBe(0.5);
    damagePart(body, 'leftArm', 100);
    expect(limbPower(body, { hands: 1, legs: 0 })).toBe(0);
    expect(limbPower(body, { hands: 0, legs: 1 })).toBe(1);
  });

  it('單腿跛行、雙腿靜止坐地、移動爬行，雙手雙腳皆失能不能移動', () => {
    const body = createBody();
    body.rightLeg = 0;
    expect(mobility(body)).toBe('limping');
    expect(movementRate(body)).toBe(0.55);
    body.leftLeg = 0;
    expect(mobility(body)).toBe('seated');
    expect(mobility(body, true)).toBe('crawling');
    expect(movementRate(body)).toBe(0.2);
    expect(limbPower(body, { hands: 1, legs: 0 })).toBe(1);
    expect(limbPower(body, { hands: 0, legs: 1 })).toBe(0);
    body.leftArm = body.rightArm = 0;
    expect(mobility(body, true)).toBe('seated');
    expect(movementRate(body)).toBe(0);
  });

  it('藥品和升級不接骨，門派調息恢復部位', () => {
    const state = createGame('測試', 'sword');
    state.body.rightArm = 0;
    state.hp = 10;
    useMedicine(state, 'herb');
    expect(state.body.rightArm).toBe(0);
    gainExperience(state, 60);
    expect(state.body.rightArm).toBe(0);
    restore(state);
    expect(state.body).toEqual(createBody());
  });
});

describe('半即時出手', () => {
  it('不用按普攻就會持續攻擊，暫停不累積時間', () => {
    const battle = new Battle(createGame('測試', 'sword'), 'boss', () => 0);
    battle.update(3);
    expect(battle.enemies[0].hp).toBe(180);
    expect(battle.clock.elapsed).toBe(0);
    battle.togglePause();
    battle.update(3);
    expect(battle.enemies[0].hp).toBeLessThan(180);
    const before = battle.enemies[0].hp;
    battle.update(3);
    expect(battle.enemies[0].hp).toBeLessThan(before);
    battle.togglePause();
    const snapshot = [battle.player.hp, battle.playerProgress, battle.clock.elapsed];
    battle.update(30);
    expect([battle.player.hp, battle.playerProgress, battle.clock.elapsed]).toEqual(snapshot);
  });

  it('不同更新切片有相同戰鬥結果', () => {
    const a = new Battle(createGame('測試', 'sword'), 'boss', () => 0);
    const b = new Battle(createGame('測試', 'sword'), 'boss', () => 0);
    a.paused = b.paused = false;
    a.update(6);
    for (let i = 0; i < 600; i++) {
      b.update(0.01);
    }
    expect(a.player).toEqual(b.player);
    expect(a.enemies).toEqual(b.enemies);
  });

  it('預約技能不立即扣內力，出手時按可用肢體重新計算', () => {
    const full = new Battle(createGame('測試', 'sword'), 'boss', () => 0);
    const injured = new Battle(createGame('測試', 'sword'), 'boss', () => 0);
    full.act({ type: 'skill', skill: 'swordfall', target: 0 });
    injured.act({ type: 'skill', skill: 'swordfall', target: 0 });
    expect(injured.player.mp).toBe(35);
    injured.player.body.rightArm = 0;
    full.update(2.25);
    injured.update(2.25);
    expect(180 - injured.enemies[0].hp).toBe(Math.round((180 - full.enemies[0].hp) / 2));
    expect(injured.player.mp).toBe(25);
  });

  it('出手前雙手失能不扣技能內力，且取消預約後恢復普攻', () => {
    const battle = new Battle(createGame('測試', 'sword'), 'boss', () => 0);
    battle.act({ type: 'skill', skill: 'swordfall', target: 0 });
    battle.player.body.leftArm = battle.player.body.rightArm = 0;
    battle.update(2.25);
    expect(battle.player.mp).toBe(35);
    expect(battle.enemies[0].hp).toBe(180);
    battle.player.body = createBody();
    battle.act({ type: 'skill', skill: 'swordfall', target: 0 });
    battle.cancelAction();
    battle.update(2.25);
    expect(battle.player.mp).toBe(35);
    expect(battle.enemies[0].hp).toBeLessThan(180);
  });

  it('集中攻擊不同腿部可令對手坐地，但仍能使用手部招式', () => {
    const battle = new Battle(createGame('測試', 'sword'), 'trial', () => 0);
    battle.targetPart = 'rightLeg';
    battle.paused = false;
    battle.update(2.25);
    expect(battle.enemies[0].body.rightLeg).toBe(0);
    battle.targetPart = 'leftLeg';
    battle.update(2.25);
    expect(battle.enemies[0].body.leftLeg).toBe(0);
    expect(mobility(battle.enemies[0].body)).toBe('seated');
    expect(battle.enemies[0].hp).toBeGreaterThan(0);
  });

  it('敵人雙手招式也套用受傷減半', () => {
    const normal = new Battle(createGame('測試', 'sword'), 'boss', () => 0);
    const injured = new Battle(createGame('測試', 'sword'), 'boss', () => 0);
    normal.autoAttack = injured.autoAttack = false;
    normal.enemies[0].actions = injured.enemies[0].actions = 2;
    injured.enemies[0].body.rightArm = 0;
    normal.paused = injured.paused = false;
    normal.update(2.3);
    injured.update(2.3);
    expect(100 - injured.player.hp).toBe(Math.round((100 - normal.player.hp) / 2));
  });
});

describe('傷勢存檔', () => {
  it('v1 自動升級為完整部位，新版保留受傷與失能', () => {
    const state = createGame('旅人', 'sword');
    const { body: _body, hair: _hair, ...legacy } = state;
    expect(_hair).toBe('Hair1');
    expect(_body).toEqual(createBody());
    const raw = JSON.stringify({
      savedAt: new Date().toISOString(),
      state: { ...legacy, version: 1 },
    });
    expect(decodeSave(raw).state).toEqual(state);
    state.body.rightArm = 0;
    state.body.leftLeg = 12;
    expect(decodeSave(encodeSave(state)).state.body).toEqual(state.body);
  });

  it('拒絕超出部位上限與缺漏部位的存檔', () => {
    const state = createGame('旅人', 'sword');
    state.body.rightArm = 999;
    expect(() => encodeSave(state)).toThrow();
    const raw = JSON.parse(JSON.stringify(state));
    delete raw.body.rightArm;
    expect(() =>
      decodeSave(JSON.stringify({ savedAt: new Date().toISOString(), state: raw })),
    ).toThrow();
  });

  it('戰鬥勝利和撤退保留傷勢，戰敗恢復可重試狀態', () => {
    for (const result of ['victory', 'escaped', 'defeat'] as const) {
      const state = createGame('旅人', 'sword');
      const battle = new Battle(state, 'patrol', () => 0);
      battle.player.body.rightLeg = 0;
      battle.result = result;
      settleBattle(state, battle);
      expect(state.body.rightLeg).toBe(result === 'defeat' ? 40 : 0);
    }
  });
});
