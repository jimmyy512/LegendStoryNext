import { describe, it, expect } from 'vitest';
import { applyStoryAction } from '../src/game/story';
import { createGame, equip, getStats } from '../src/game/state';
import { encodeSave, decodeSave } from '../src/game/save';
import { equipmentRewardPanel } from '../src/ui/canvas/storyPanels';

describe('chapter equipment discovery', () => {
  it('awards distinct equipment once, survives reload, and waits for the player to equip', () => {
    let state = createGame('旅人', 'sword');
    const base = getStats(state);
    const rewards = ['strawHat', 'guardPants', 'taoistCrown'] as const;
    const chests = ['forest-chest', 'mountain-chest', 'cave-chest'];
    chests.forEach((chest, index) => {
      const outcome = applyStoryAction(state, `chest:${chest}`);
      expect(outcome.equipmentReward).toBe(rewards[index]);
      expect(state.inventory[rewards[index]]).toBe(1);
      state = decodeSave(encodeSave(state)).state;
      const snapshot = structuredClone(state);
      expect(applyStoryAction(state, `chest:${chest}`)).toEqual({});
      expect(state).toEqual(snapshot);
    });
    expect(getStats(state)).toEqual(base);
    expect(equip(state, 'guardPants')).toBe(true);
    expect(getStats(state).defense).toBe(base.defense + 2);
  });
  it('wine delivery gives boots only once and exposes a real inspect action', () => {
    const state = createGame('旅人', 'fist');
    applyStoryAction(state, 'pick-wine');
    const outcome = applyStoryAction(state, 'deliver-wine');
    expect(state.inventory.swiftBoots).toBe(1);
    expect(state.boots).toBe('brownBoots');
    expect(outcome.equipmentReward).toBe('swiftBoots');
    const snapshot = structuredClone(state);
    applyStoryAction(state, 'deliver-wine');
    expect(state).toEqual(snapshot);
    expect(equipmentRewardPanel(outcome.equipmentReward!, outcome.message!).rows).toContainEqual({
      kind: 'action',
      label: '查看並換裝',
      action: 'inspect-item:swiftBoots',
    });
  });
});
