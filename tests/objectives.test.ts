import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { activeObjective, nextObjective } from '../src/game/objectives';
import { PanelView } from '../src/ui/PanelView';
import { applyStoryAction, getDialogue } from '../src/game/story';
import { decodeSave, encodeSave } from '../src/game/save';
import { MAPS } from '../src/data/maps';
import type { MapId, QuestStage } from '../src/game/types';

describe('player objective guidance', () => {
  it('keeps recovery selected through travel and full HP until body injuries heal', () => {
    const state = createGame('旅人', 'fist');
    state.quest = 'investigate';
    state.body.rightArm = 16;
    expect(activeObjective(state, 'rest')).toBe('rest');
    expect(nextObjective(state, 'rest')?.to).toBe('temple');
    const panel = new PanelView().render(state, 'character', {
      saveSlots: [],
      reducedMotion: false,
      audioVolume: 0,
    });
    expect(JSON.stringify(panel)).toContain('guide:rest');
    state.map = 'temple';
    expect(activeObjective(state, 'rest')).toBe('rest');
    expect(nextObjective(state, 'rest')?.id).toBe('wo');
    applyStoryAction(state, 'rest');
    expect(activeObjective(state, 'rest')).toBe('main');
    expect(nextObjective(state)?.to).toBe('mountain');
  });
  it('keeps a side quest selected after pickup and returns to the main quest after delivery', () => {
    const state = createGame('旅人', 'sword');
    state.quest = 'investigate';
    state.map = 'temple';
    expect(activeObjective(state, 'wine')).toBe('wine');
    expect(nextObjective(state, 'wine')?.to).toBe('forest');
    state.map = 'forest';
    applyStoryAction(state, 'pick-wine');
    expect(activeObjective(state, 'wine')).toBe('wine');
    expect(nextObjective(state, 'wine')?.to).toBe('temple');
    state.map = 'temple';
    expect(nextObjective(state, 'wine')?.id).toBe('fong');
    applyStoryAction(state, 'deliver-wine');
    expect(activeObjective(state, 'wine')).toBe('main');
  });
  it('remembers the chosen bandit destination without committing the force ending', () => {
    let state = createGame('旅人', 'fist');
    state.quest = 'bandits';
    const wounded = MAPS.forest.entities.find((entity) => entity.id === 'wounded')!;
    expect(nextObjective(state)?.id).toBe('wounded');
    expect(
      getDialogue(state, wounded).choices.some((choice) => choice.action === 'seek-bandits'),
    ).toBe(true);
    applyStoryAction(state, 'seek-bandits');
    state = decodeSave(encodeSave(state)).state;
    expect(nextObjective(state)?.id).toBe('bandits');
    expect(state.flags).not.toContain('force');
    expect(state.quest).toBe('bandits');
    state.map = 'temple';
    expect(nextObjective(state)?.to).toBe('forest');
    state.map = 'forest';
    expect(getDialogue(state, wounded).choices.some((choice) => choice.action === 'mercy')).toBe(
      true,
    );
    applyStoryAction(state, 'mercy');
    expect(state.flags).toContain('mercy');
    expect(state.flags).not.toContain('force');
    expect(state.quest).toBe('investigate');
    expect(nextObjective(state)?.to).toBe('temple');
  });
  it('offers both bandit approaches locally without bypassing map travel or committing a branch', () => {
    const state = createGame('旅人', 'sword');
    state.quest = 'bandits';
    state.inventory.herb = 0;
    const rows = () =>
      new PanelView()
        .render(state, 'journal', {
          saveSlots: [],
          reducedMotion: false,
          audioVolume: 0,
        })
        .sections!.find((section) => section.id === 'main')!.rows;
    const original = structuredClone(state);
    expect(JSON.stringify(rows())).toContain('travel:wounded');
    expect(JSON.stringify(rows())).toContain('travel:bandits');
    expect(JSON.stringify(rows())).toContain('現有 0 份');
    expect(state).toEqual(original);
    state.map = 'temple';
    expect(JSON.stringify(rows())).toContain('guide:main');
    expect(JSON.stringify(rows())).not.toContain('travel:bandits');
    state.quest = 'investigate';
    expect(JSON.stringify(rows())).not.toContain('找山賊頭目');
  });
  it('routes recovery to a healer who remains available through all story stages', () => {
    const state = createGame('旅人', 'sword');
    const expected = { forest: 'temple', mountain: 'temple', cave: 'mountain' };
    for (const [map, destination] of Object.entries(expected)) {
      state.map = map as MapId;
      expect(nextObjective(state, 'rest')?.to).toBe(destination);
    }
    state.map = 'temple';
    const healer = nextObjective(state, 'rest')!;
    expect(healer.id).toBe('wo');
    for (const quest of [
      'arrival',
      'trial',
      'report',
      'bandits',
      'investigate',
      'boss',
      'return',
      'complete',
    ]) {
      state.quest = quest as QuestStage;
      expect(getDialogue(state, healer).choices.some((choice) => choice.action === 'rest')).toBe(
        true,
      );
    }
  });
  it('guides one real map transition at a time before the local character', () => {
    const state = createGame('旅人', 'sword');
    expect(nextObjective(state)?.to).toBe('temple');
    state.map = 'temple';
    expect(nextObjective(state)?.id).toBe('qing');
    state.map = 'forest';
    state.quest = 'investigate';
    expect(nextObjective(state)?.to).toBe('temple');
    state.map = 'temple';
    expect(nextObjective(state)?.to).toBe('mountain');
    state.map = 'mountain';
    expect(nextObjective(state)?.to).toBe('cave');
    state.map = 'cave';
    expect(nextObjective(state)?.id).toBe('journal');
  });
  it('respects the guardian before directing to the boss', () => {
    const state = createGame('旅人', 'sword');
    state.map = 'cave';
    state.quest = 'boss';
    expect(nextObjective(state)?.id).toBe('undead');
    state.defeated.push('undead');
    expect(nextObjective(state)?.id).toBe('boss');
    state.quest = 'complete';
    expect(nextObjective(state)).toBeNull();
  });
  it('reveals side quests on discovery and switches from searching to delivery', () => {
    const state = createGame('旅人', 'sword');
    const panel = () =>
      new PanelView().render(state, 'journal', {
        saveSlots: [],
        reducedMotion: false,
        audioVolume: 0,
      });
    expect(panel().sections?.some((s) => s.id === 'herb' || s.id === 'wine')).toBe(false);
    state.inventory.wine = 1;
    state.map = 'temple';
    expect(panel().sections?.find((s) => s.id === 'wine')?.caption).toContain('可交付');
    expect(nextObjective(state, 'wine')?.id).toBe('fong');
    state.flags.push('wine-done');
    expect(nextObjective(state, 'wine')).toBeNull();
  });
});
