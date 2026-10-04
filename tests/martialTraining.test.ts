import { describe, expect, it } from 'vitest';
import { createGame, getStats } from '../src/game/state';
import { changeMartialArt, studyMartialArt } from '../src/game/martialTraining';
import { GameSession } from '../src/game/GameSession';
import { MAPS } from '../src/data/maps';
import { decodeSave, encodeSave } from '../src/game/save';
import { Battle } from '../src/game/battle';

describe('門派傳授與武學變更', () => {
  it('未拜師不得領取，必須在山門向徐長卿學習，不可重領兵器', () => {
    const state = createGame('俠客', 'fist');
    state.map = 'temple';
    expect(studyMartialArt(state)).toBe(false);
    state.quest = 'bandits';
    state.map = 'forest';
    expect(studyMartialArt(state)).toBe(false);
    state.map = 'temple';
    const session = new GameSession();
    session.start(state);
    const qing = MAPS.temple.entities.find((e) => e.id === 'qing')!;
    const wo = MAPS.temple.entities.find((e) => e.id === 'wo')!;
    expect(session.choose(wo, 'study-martial')).toEqual({});
    expect(session.choose(qing, 'study-martial').martialTraining).toBe(true);
    expect(session.state?.inventory.sword).toBe(1);
    expect(session.choose(qing, 'study-martial')).toEqual({});
    expect(session.state?.inventory.sword).toBe(1);
  });

  it('切換同步招式、內功與武器，保留五欄其餘裝備與傷勢，不可補血', () => {
    const state = createGame('俠客', 'fist');
    state.quest = 'bandits';
    state.map = 'temple';
    state.inventory.wraps = 1;
    state.weapon = 'wraps';
    state.body.leftArm = 12;
    state.mp = 3;
    expect(changeMartialArt(state, 'sword')).toBe(false);
    expect(studyMartialArt(state)).toBe(true);
    const before = structuredClone(state);
    expect(changeMartialArt(state, 'sword')).toBe(true);
    expect(state.weapon).toBe('sword');
    expect(state.hp).toBe(100);
    expect(state.mp).toBe(3);
    expect(state.body).toEqual(before.body);
    expect([state.armor, state.pants, state.boots, state.headwear]).toEqual([
      before.armor,
      before.pants,
      before.boots,
      before.headwear,
    ]);
    const battle = new Battle(state, 'patrol');
    expect(battle.act({ type: 'skill', skill: 'dragon', target: 0 })).not.toBeNull();
    battle.player.mp = 35;
    expect(battle.act({ type: 'skill', skill: 'pierce', target: 0 })).toBeNull();
    expect(battle.stats).toEqual(getStats(state));
    expect(changeMartialArt(state, 'fist')).toBe(true);
    expect(state.hp).toBe(100);
    expect(state.weapon).toBe('wraps');
    expect(changeMartialArt(state, 'bogus')).toBe(false);
  });

  it('已售出的兵器不會憑空回來，讀檔保存學習與配置，交戰禁止切換', () => {
    const state = createGame('俠客', 'sword');
    state.quest = 'complete';
    state.map = 'temple';
    studyMartialArt(state);
    state.inventory.wraps = 0;
    expect(changeMartialArt(state, 'fist')).toBe(true);
    expect(state.weapon).toBeNull();
    const loaded = decodeSave(encodeSave(state)).state;
    expect(loaded).toEqual(state);
    const session = new GameSession();
    session.start(loaded);
    session.startBattle('patrol');
    expect(session.changeMartialArt('sword')).toBe(false);
    expect(session.state?.route).toBe('fist');
  });
});
