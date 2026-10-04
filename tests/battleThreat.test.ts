import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { battleThreat } from '../src/game/battleThreat';
import { createGame } from '../src/game/state';

describe('multiple opponent warnings', () => {
  it('detects an unselected opponent while the selected one is far away', () => {
    const battle = new Battle(createGame('旅人', 'sword'), 'bandits');
    battle.target = 0;
    battle.enemies[0].position = battle.playerPosition + 9;
    battle.enemies[1].position = battle.playerPosition + 3;
    battle.enemies[1].strikeRange = { min: 1, max: 4 };
    expect(battleThreat(battle)).toEqual({
      count: 1,
      warning: `${battle.enemies[1].name} 2正在出手！拉開或防禦`,
    });
    battle.enemies[1].hp = 0;
    expect(battleThreat(battle)).toEqual({ count: 0, warning: null });
  });

  it('uses the committed strike range and stops warning once the player escapes it', () => {
    const battle = new Battle(createGame('旅人', 'sword'), 'bandits');
    battle.enemies[0].position = battle.playerPosition + 3;
    battle.enemies[1].position = battle.playerPosition + 9;
    battle.enemies[0].strikeRange = { min: 1, max: 2 };
    expect(battleThreat(battle)).toEqual({ count: 0, warning: null });
    battle.enemies[0].strikeRange = { min: 1, max: 4 };
    expect(battleThreat(battle).count).toBe(1);
    expect(battleThreat(battle).warning).toContain('正在出手');
  });
});
