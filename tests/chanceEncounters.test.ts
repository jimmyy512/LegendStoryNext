import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { createGame } from '../src/game/state';
import { decodeSave, encodeSave } from '../src/game/save';
import { GameSession } from '../src/game/GameSession';
import { getDialogue } from '../src/game/story';
import { findPath, isWalkable } from '../src/game/pathfinding';
import {
  FIRST_COMPANIONS,
  CHANCE_ENCOUNTERS,
  companionProgress,
  companionMeeting,
  encounterRecords,
  resolveEncounter,
} from '../src/game/chanceEncounters';

describe('第一章紅顏奇遇', () => {
  it('人物回訪提示跟實際事件解鎖條件一致', () => {
    const state = createGame('旅人', 'sword');
    resolveEncounter(state, 'chance:medicine-box:cloth');
    expect(companionMeeting(state, 'qinglan')).toMatchObject({ ready: false });
    expect(companionMeeting(state, 'qinglan').text).toContain('入門切磋');
    state.quest = 'report';
    expect(companionMeeting(state, 'qinglan')).toMatchObject({ ready: true });
    resolveEncounter(state, 'chance:medicine-scent:help');
    expect(companionMeeting(state, 'qinglan').text).toContain('尚未開放');
    resolveEncounter(state, 'chance:hidden-letter:trust');
    expect(companionMeeting(state, 'tangwan').ready).toBe(false);
    state.quest = 'investigate';
    expect(companionMeeting(state, 'tangwan').ready).toBe(true);
    state.map = 'mountain';
    resolveEncounter(state, 'chance:stone-song:listen');
    expect(companionMeeting(state, 'suyin').ready).toBe(false);
    state.inventory.journal = 1;
    expect(companionMeeting(state, 'suyin').ready).toBe(true);
  });
  it('初見的消耗與獎勵只發一次，不能改選另一項刷關係', () => {
    const state = createGame('旅人', 'sword');
    const herb = state.inventory.herb;
    const tonic = state.inventory.tonic;
    resolveEncounter(state, 'chance:medicine-box:medicine');
    expect(state.inventory.herb).toBe(herb - 1);
    expect(state.inventory.tonic).toBe(tonic + 1);
    expect(companionProgress(state, 'qinglan').trust).toBe(3);
    expect(resolveEncounter(state, 'chance:medicine-box:cloth')).toBeNull();
    expect(companionProgress(state, 'qinglan').trust).toBe(3);
  });
  it('沒有藥仍可相識，不能偽造交藥選項', () => {
    const state = createGame('旅人', 'fist');
    state.inventory.herb = 0;
    const entity = MAPS.forest.entities.find((e) => e.id === 'chance-qinglan')!;
    const dialogue = getDialogue(state, entity);
    expect(dialogue.choices.some((c) => c.action.endsWith(':medicine'))).toBe(false);
    expect(resolveEncounter(state, 'chance:medicine-box:medicine')).toBeNull();
    expect(resolveEncounter(state, 'chance:medicine-box:cloth')).not.toBeNull();
    expect(companionProgress(state, 'qinglan').stage).toBe('相識');
  });
  it('後續見面需有初見及主線進度，錯圖與未知選項都不改狀態', () => {
    const state = createGame('旅人', 'sword');
    const before = structuredClone(state);
    expect(resolveEncounter(state, 'chance:medicine-scent:help')).toBeNull();
    expect(resolveEncounter(state, 'chance:medicine-box:invalid')).toBeNull();
    expect(state).toEqual(before);
    resolveEncounter(state, 'chance:medicine-box:cloth');
    expect(resolveEncounter(state, 'chance:medicine-scent:help')).toBeNull();
    state.quest = 'report';
    state.map = 'temple';
    expect(resolveEncounter(state, 'chance:medicine-scent:help')).toBeNull();
    state.map = 'forest';
    expect(resolveEncounter(state, 'chance:medicine-scent:help')).not.toBeNull();
    expect(companionProgress(state, 'qinglan').stage).toBe('熟識');
  });
  it('已完成第一章與採集的舊存檔仍可遇見所有三人、完成六件奇遇', () => {
    const state = createGame('旅人', 'sword');
    state.quest = 'complete';
    state.inventory.journal = 1;
    state.flags.push('flower-picked', 'herb-done', 'wine-picked', 'wine-done');
    state.opened.push('forest-chest');
    for (const event of CHANCE_ENCOUNTERS) {
      state.map = event.map;
      expect(
        resolveEncounter(state, `chance:${event.id}:${event.choices.at(-1)!.id}`),
      ).not.toBeNull();
    }
    expect(encounterRecords(state)).toHaveLength(6);
    expect(FIRST_COMPANIONS.every((c) => companionProgress(state, c.id).stage !== '未相識')).toBe(
      true,
    );
    expect(state.quest).toBe('complete');
    expect(state.opened).toContain('forest-chest');
  });
  it('存讀檔保留選擇與信任，回訪不重複獎勵', () => {
    const state = createGame('旅人', 'sword');
    resolveEncounter(state, 'chance:hidden-letter:trust');
    const restored = decodeSave(encodeSave(state)).state;
    expect(companionProgress(restored, 'tangwan').trust).toBe(3);
    expect(resolveEncounter(restored, 'chance:hidden-letter:check')).toBeNull();
  });
  it.each(FIRST_COMPANIONS)('$name 的地點位於可走道路，且入口可到達相鄰位置', (person) => {
    const map = MAPS[person.map];
    const entity = map.entities.find((e) => e.id === person.entity)!;
    expect(isWalkable(map, entity)).toBe(true);
    const start = person.map === 'forest' ? { x: 2, y: 7 } : { x: 2, y: 4 };
    const neighbours = [
      { x: entity.x - 1, y: entity.y },
      { x: entity.x + 1, y: entity.y },
      { x: entity.x, y: entity.y - 1 },
      { x: entity.x, y: entity.y + 1 },
    ];
    expect(
      neighbours.some((point) => isWalkable(map, point) && findPath(map, start, point).length > 0),
    ).toBe(true);
  });
  it('GameSession 只接受當前奇遇對話提供的選項', () => {
    const session = new GameSession();
    session.start(createGame('旅人', 'sword'));
    const entity = MAPS.forest.entities.find((e) => e.id === 'chance-qinglan')!;
    session.choose(entity, 'chance:medicine-scent:help');
    expect(encounterRecords(session.state!)).toHaveLength(0);
    session.choose(entity, 'chance:medicine-box:cloth');
    expect(encounterRecords(session.state!)).toHaveLength(1);
  });
});
