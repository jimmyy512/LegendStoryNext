import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/GameSession';
import { createBody } from '../src/game/body';
import { createGame } from '../src/game/state';

describe('無法移動時的求援', () => {
  it('換圖前保留原狀，回山門恢復身體且不改任務與物品', () => {
    const session = new GameSession();
    const state = createGame('旅人', 'fist');
    state.map = 'cave';
    state.quest = 'boss';
    state.body = { ...createBody(), leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
    state.hp = 18;
    session.start(state);
    const recovered = session.prepareRescue();
    expect(session.state).toEqual(state);
    expect(recovered.map).toBe('temple');
    expect(recovered.body).toEqual(createBody());
    expect(recovered.quest).toBe('boss');
    expect(recovered.inventory).toEqual(state.inventory);
    expect(recovered.gold).toBe(state.gold);
    session.start(recovered);
    expect(session.state!.hp).toBeGreaterThan(18);
  });
  it('可移動或正在戰鬥時不可用求援跳過路程或戰鬥', () => {
    const session = new GameSession();
    expect(() => session.prepareRescue()).toThrow();
    const state = createGame('旅人', 'sword');
    session.start(state);
    expect(() => session.prepareRescue()).toThrow();
    state.body = { ...createBody(), leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
    session.start(state);
    session.startBattle('trial');
    expect(() => session.prepareRescue()).toThrow();
  });
});
