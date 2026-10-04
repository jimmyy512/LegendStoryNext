import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { GameSession } from '../src/game/GameSession';
import { createGame } from '../src/game/state';
import { decodeSave, encodeSave } from '../src/game/save';
import {
  availableTalentPoints,
  learnTalent,
  resetTalents,
  type TalentId,
} from '../src/game/talents';
import { activeObjective, nextObjective } from '../src/game/objectives';

describe('第一章天賦配置', () => {
  it('第 2、3 重各一點，舊存檔補上空配置但不重複發點', () => {
    const state = createGame('舊旅程', 'fist');
    expect(availableTalentPoints(state)).toBe(0);
    state.level = 2;
    expect(availableTalentPoints(state)).toBe(1);
    const old = JSON.parse(encodeSave(state));
    delete old.state.talents;
    const migrated = decodeSave(JSON.stringify(old)).state;
    expect(migrated.talents).toEqual([]);
    expect(learnTalent(migrated, 'breath')).toBe(true);
    expect(learnTalent(migrated, 'breath')).toBe(false);
    expect(learnTalent(migrated, 'opening')).toBe(false);
    migrated.level = 3;
    expect(learnTalent(migrated, 'opening')).toBe(true);
    const loaded = decodeSave(encodeSave(migrated)).state;
    expect(loaded.talents).toEqual(['breath', 'opening']);
    expect(availableTalentPoints(loaded)).toBe(0);
    loaded.level = 10;
    expect(availableTalentPoints(loaded)).toBe(0);
  });

  it('拒收超支、重複或不存在的天賦存檔', () => {
    const state = createGame('驗證', 'sword');
    const envelope = JSON.parse(encodeSave(state));
    for (const talents of [['opening'], ['fake'], ['breath', 'breath']]) {
      envelope.state.talents = talents;
      expect(() => decodeSave(JSON.stringify(envelope))).toThrow();
    }
    envelope.state.level = 3;
    envelope.state.talents = ['breath', 'breath'];
    expect(() => decodeSave(JSON.stringify(envelope))).toThrow();
  });

  it('山門免費重配不補血補氣、不清傷勢，交戰中不可改配置', () => {
    const state = createGame('修習', 'fist');
    state.level = 3;
    learnTalent(state, 'breath');
    expect(resetTalents(state)).toBe(false);
    state.map = 'temple';
    state.hp = 50;
    state.mp = 1;
    state.body.leftArm = 0;
    const before = structuredClone(state);
    expect(resetTalents(state)).toBe(true);
    expect(state).toEqual({ ...before, talents: [] });
    const session = new GameSession();
    session.start(state);
    expect(session.changeTalent('opening')).toBe(true);
    session.startBattle('trial');
    expect(session.changeTalent('breath')).toBe(false);
    expect(session.changeTalent('reset')).toBe(false);
  });

  it('滿血也能從洞穴逐圖帶路回山門重新配置', () => {
    const state = createGame('帶路', 'sword');
    state.quest = 'complete';
    state.map = 'cave';
    expect(activeObjective(state, 'training')).toBe('training');
    expect(nextObjective(state, 'training')?.to).toBe('mountain');
    state.map = 'mountain';
    expect(nextObjective(state, 'training')?.to).toBe('temple');
    state.map = 'temple';
    expect(activeObjective(state, 'training')).toBe('main');
  });
});

function prepared(talents: TalentId[] = []): Battle {
  const state = createGame('演武', 'sword');
  state.level = 3;
  state.talents = talents;
  state.mp = 1;
  const battle = new Battle(state, 'trial', () => 0);
  battle.paused = false;
  battle.autoAttack = false;
  battle.holdingPosition = true;
  battle.enemies[0].position = 13;
  return battle;
}

describe('天賦實際戰鬥效果', () => {
  it('乘隙而入只強化一次破綻命中，正常攻擊不變', () => {
    const hit = (talents: TalentId[], opening: boolean) => {
      const b = prepared(talents);
      b.enemies[0].opening = opening;
      b.enemies[0].recovery = 10;
      b.playerProgress = 1;
      b.act({ type: 'attack', target: 0 });
      const events = b.update(1);
      expect(b.enemies[0].opening).toBe(false);
      return events.find((e) => e.kind === 'damage' && e.source === 'player')!.amount!;
    };
    expect(hit(['opening'], true)).toBeGreaterThan(hit([], true));
    expect(hit(['opening'], false)).toBe(hit([], false));
  });

  it('守中養氣只在防禦接下重擊時回氣，且不超過上限', () => {
    const hit = (heavy: boolean, defend: boolean, mp = 1) => {
      const b = prepared(['breath']);
      b.player.mp = mp;
      b.enemies[0].actions = heavy ? 1 : 0;
      b.enemies[0].progress = 1;
      if (defend) {
        b.act({ type: 'defend' });
      }
      const events = b.update(2.2);
      expect(events.some((e) => e.kind === 'damage' && e.target === 'player')).toBe(true);
      return b.player.mp;
    };
    expect(hit(true, true)).toBe(5);
    expect(hit(false, true)).toBe(1);
    expect(hit(true, false)).toBe(1);
    expect(hit(true, true, 44)).toBe(45);
  });

  it('游身卸力只獎勵躲開重擊，不獎勵普通落空', () => {
    const dodge = (talents: TalentId[], heavy: boolean) => {
      const b = prepared(talents);
      b.enemies[0].actions = heavy ? 1 : 0;
      b.enemies[0].progress = 1;
      b.update(0.1);
      b.playerPosition = 8;
      b.stamina = 40;
      const events = b.update(2);
      expect(events.some((e) => e.kind === 'miss')).toBe(true);
      return { stamina: b.stamina, events };
    };
    const talented = dodge(['footwork'], true);
    expect(talented.stamina - dodge([], true).stamina).toBeCloseTo(15);
    expect(talented.events.some((e) => e.kind === 'talent')).toBe(true);
    expect(dodge(['footwork'], false).stamina).toBeCloseTo(dodge([], false).stamina);
  });
});
