import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { createGame } from '../src/game/state';
import { getDialogue } from '../src/game/story';

describe('路線對話', () => {
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
});
