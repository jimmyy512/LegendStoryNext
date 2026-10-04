import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { battleOutcome } from '../src/game/battleOutcome';
import { createGame } from '../src/game/state';
import { ITEMS } from '../src/data/content';

describe('battle settlement presentation', () => {
  it('gives defeat advice based on opponents still standing', () => {
    const battle = new Battle(createGame('旅人', 'sword'), 'bandits');
    battle.result = 'defeat';
    expect(battleOutcome(battle).title).toBe('此戰敗退');
    expect(battleOutcome(battle).next).toContain('集中擊倒一名');
    battle.enemies[0].hp = 0;
    expect(battleOutcome(battle).next).toContain('防禦後趁破綻');
  });
  it('previews growth, retained injuries and the next objective without granting rewards', () => {
    const state = createGame('旅人', 'sword');
    state.quest = 'trial';
    state.map = 'temple';
    state.xp = 50;
    const battle = new Battle(state, 'trial');
    battle.player.hp = 65;
    battle.player.body.leftArm = 12;
    battle.result = 'victory';
    const before = structuredClone(battle.player);
    const summary = battleOutcome(battle);
    expect(summary.rewards).toBe('銀兩 +12　修為 +25');
    expect(summary.growth).toContain('突破第 2 重');
    expect(summary.progress).toBe(15 / 120);
    expect(summary.condition).toContain('左手受傷');
    expect(summary.next).toContain('上真道長');
    expect(battle.player).toEqual(before);
    expect(state.xp).toBe(50);
  });
  it('includes story loot granted by the same settlement rules', () => {
    const state = createGame('旅人', 'fist');
    state.quest = 'bandits';
    const battle = new Battle(state, 'bandits');
    battle.result = 'victory';
    expect(battleOutcome(battle).loot).toBe(`${ITEMS.letter.name} ×1`);
    expect(battle.player.inventory.letter).toBe(0);
  });
  it('does not promise rewards for retreat, defeat or an already settled encounter', () => {
    const battle = new Battle(createGame('旅人', 'sword'), 'patrol');
    battle.result = 'escaped';
    expect(battleOutcome(battle).rewards).toBe('本場未獲得獎勵');
    battle.result = 'defeat';
    expect(battleOutcome(battle).condition).toContain('本場消耗');
    battle.result = 'victory';
    battle.player.defeated.push('patrol');
    expect(battleOutcome(battle).rewards).toBe('本場獎勵已領取');
  });
});
