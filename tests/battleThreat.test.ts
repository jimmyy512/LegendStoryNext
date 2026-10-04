import { describe, expect, it } from 'vitest';
import { BATTLE_LEFT, Battle } from '../src/game/battle';
import { battleThreat } from '../src/game/battleThreat';
import { createGame } from '../src/game/state';

describe('multiple opponent warnings', () => {
  it('detects an unselected opponent while the selected one is far away', () => {
    const battle = new Battle(createGame('旅人', 'sword'), 'bandits');
    battle.target = 0;
    battle.enemies[0].position = battle.playerPosition + 9;
    battle.enemies[1].position = battle.playerPosition + 3;
    battle.enemies[1].strikeRange = { min: 1, max: 4 };
    battle.enemies[1].windup = 1.2;
    expect(battleThreat(battle)).toEqual({
      count: 1,
      warning: `${battle.enemies[1].name} 2正在出手！拉開或防禦`,
      canRetreat: true,
    });
    battle.enemies[1].hp = 0;
    expect(battleThreat(battle)).toEqual({ count: 0, warning: null, canRetreat: false });
  });

  it('uses the committed strike range and stops warning once the player escapes it', () => {
    const battle = new Battle(createGame('旅人', 'sword'), 'bandits');
    battle.enemies[0].position = battle.playerPosition + 3;
    battle.enemies[1].position = battle.playerPosition + 9;
    battle.enemies[0].strikeRange = { min: 1, max: 2 };
    expect(battleThreat(battle)).toEqual({ count: 0, warning: null, canRetreat: false });
    battle.enemies[0].strikeRange = { min: 1, max: 4 };
    expect(battleThreat(battle).count).toBe(1);
    expect(battleThreat(battle).warning).toContain('正在出手');
  });

  it('does not recommend retreat against a wall, a short tell, or an injured leg', () => {
    const battle = new Battle(createGame('旅人', 'sword'), 'bandits');
    battle.enemies[0].position = battle.playerPosition + 2;
    battle.enemies[1].hp = 0;
    battle.enemies[0].strikeRange = { min: 1, max: 4 };
    battle.enemies[0].windup = 1.2;
    expect(battleThreat(battle).canRetreat).toBe(true);
    battle.player.body.leftLeg = 0;
    expect(battleThreat(battle).canRetreat).toBe(false);
    battle.player.body.leftLeg = 40;
    battle.enemies[0].windup = 0.2;
    expect(battleThreat(battle).canRetreat).toBe(false);
    battle.playerPosition = BATTLE_LEFT;
    battle.enemies[0].position = BATTLE_LEFT + 2;
    battle.enemies[0].windup = 1.2;
    expect(battleThreat(battle).warning).toContain('退不出射程，立即防禦');
  });
});
