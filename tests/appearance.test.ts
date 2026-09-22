import { describe, expect, it } from 'vitest';
import { HAIR_STYLES } from '../src/game/appearance';
import { GameSession } from '../src/game/GameSession';
import { decodeSave, encodeSave } from '../src/game/save';
import { createGame } from '../src/game/state';
import { heroAppearance } from '../src/render/heroAppearance';

describe('正式旅程髮型', () => {
  it('四種外觀都能經存檔往返與顯示映射保留', () => {
    const session = new GameSession();
    session.start(createGame('旅人', 'sword'));
    for (const hair of HAIR_STYLES) {
      expect(session.changeHair(hair)).toBe(true);
      const restored = decodeSave(encodeSave(session.state!)).state;
      expect(restored.hair).toBe(hair);
      expect(heroAppearance(restored).hair).toBe(hair);
      expect(restored.version).toBe(3);
    }
  });

  it('拒絕未知髮型與戰鬥中更換，不變更能力', () => {
    const session = new GameSession();
    session.start(createGame('旅人', 'fist'));
    const before = session.state!;
    expect(session.changeHair('missing')).toBe(false);
    expect(session.state).toEqual(before);
    session.startBattle('patrol');
    expect(session.changeHair('Hair4')).toBe(false);
    expect(session.state).toEqual(before);
  });

  it('v2 缺少髮型時補束髮，保留已有傷勢與進度', () => {
    const state = createGame('舊旅人', 'sword');
    state.body.rightArm = 0;
    state.flags.push('mercy');
    const { hair, ...previous } = state;
    expect(hair).toBe('Hair1');
    const raw = JSON.stringify({
      savedAt: new Date().toISOString(),
      state: { ...previous, version: 2 },
    });
    expect(decodeSave(raw).state).toEqual(state);
  });

  it('v3 缺漏或未知髮型不默默接受，舊版本的額外欄位也拒絕', () => {
    const state = createGame('旅人', 'sword');
    const record = JSON.parse(encodeSave(state));
    record.state.hair = 'missing';
    expect(() => decodeSave(JSON.stringify(record))).toThrow();
    delete record.state.hair;
    expect(() => decodeSave(JSON.stringify(record))).toThrow();
    record.state.version = 2;
    record.state.unexpected = true;
    expect(() => decodeSave(JSON.stringify(record))).toThrow();
  });
});
