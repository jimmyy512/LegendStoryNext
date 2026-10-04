import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { createGame } from '../src/game/state';
import { getDialogue, isEntityVisible } from '../src/game/story';
import { decodeSave, encodeSave } from '../src/game/save';
import { GameSession } from '../src/game/GameSession';

describe('路線對話', () => {
  it('復仇之誓沿用入門流程，讀檔保留選擇並改變師父的囑咐', () => {
    const session = new GameSession();
    session.start(createGame('小白', 'sword'));
    const qing = MAPS.temple.entities.find((entity) => entity.id === 'qing')!;
    session.choose(qing, 'accept-trial-revenge');
    const restored = decodeSave(encodeSave(session.state!)).state;
    expect(restored.quest).toBe('trial');
    expect(restored.flags).toContain('revenge-vowed');
    restored.quest = 'report';
    const master = MAPS.temple.entities.find((entity) => entity.id === 'master')!;
    const dialogue = getDialogue(restored, master);
    expect(dialogue.lines.join('')).toContain('我知道你要報仇');
    expect(dialogue.beats?.length).toBe(dialogue.lines.length);
    expect(dialogue.choices[0].action).toBe('join');
  });
  it('收起手札後從場景移除，讀檔仍保留線索與首領進度', () => {
    const state = createGame('旅人', 'fist');
    state.quest = 'investigate';
    state.map = 'cave';
    state.position = { x: 7, y: 7 };
    const journal = MAPS.cave.entities.find((entity) => entity.id === 'journal')!;
    expect(isEntityVisible(state, journal)).toBe(true);
    const session = new GameSession();
    session.start(state);
    session.choose(journal, 'journal');
    const restored = decodeSave(encodeSave(session.state!)).state;
    expect(restored.inventory.journal).toBe(1);
    expect(restored.quest).toBe('boss');
    expect(isEntityVisible(restored, journal)).toBe(false);
  });
  it.each([
    ['sword', '拔劍應戰'],
    ['fist', '出掌應戰'],
  ] as const)('%s 的應戰文案符合武學，不改變戰鬥入口', (route, label) => {
    const state = createGame('旅人', route);
    state.quest = 'bandits';
    const entity = MAPS.forest.entities.find((entry) => entry.id === 'bandits')!;
    expect(getDialogue(state, entity).choices).toContainEqual({
      label,
      action: 'battle:bandits',
    });
  });

  it.each(['mercy', 'force'])('%s 首領戰後可讀收尾，不再提供重戰或重複獎勵', (branch) => {
    const state = createGame('旅人', 'sword');
    state.quest = 'return';
    state.defeated = ['undead', 'boss'];
    state.flags.push(branch);
    const entity = MAPS.cave.entities.find((entry) => entry.id === 'boss')!;
    const dialogue = getDialogue(state, entity);
    expect(dialogue.role).toBe('藏霧洞 · 戰後');
    expect(dialogue.lines).toHaveLength(3);
    expect(dialogue.choices).toEqual([{ label: '帶手札回山覆命', action: 'close' }]);
    const snapshot = structuredClone(state);
    const session = new GameSession();
    session.start(state);
    session.choose(entity, 'close');
    expect(session.state).toEqual(snapshot);
  });
});
