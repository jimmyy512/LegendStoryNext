import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/content';
import { Battle } from '../src/game/battle';
import { createCombatPreview, prepareCombatPreview } from '../src/game/combatPreview';
import { getStats } from '../src/game/state';

describe('高等級演武', () => {
  for (const route of ['sword', 'fist'] as const) {
    for (const encounter of ['trial', 'bandits', 'boss']) {
      it(`${route}/${encounter} 有完整內力且開場十五秒仍可交鋒`, () => {
        const originals = structuredClone(ENEMIES);
        const state = createCombatPreview(route);
        const battle = new Battle(state, encounter, () => 0.5);
        prepareCombatPreview(battle);
        expect(state.level).toBe(10);
        expect(state.hp).toBe(getStats(state).maxHp);
        expect(state.mp).toBe(80);
        expect(battle.enemies.every((enemy) => enemy.level === 10)).toBe(true);
        battle.paused = false;
        battle.update(15);
        expect(battle.result).toBeNull();
        expect(battle.player.hp).toBeGreaterThan(0);
        expect(battle.enemies[0].hp).toBeLessThan(battle.enemies[0].stats.maxHp);
        battle.update(165);
        expect(battle.result).not.toBeNull();
        expect(ENEMIES).toEqual(originals);
      });
    }
  }
});

describe('第一章首領實玩預覽', () => {
  it.each(['sword', 'fist'] as const)('%s 保留第一章敵方原始數值', (route) => {
    const state = createCombatPreview(route, true);
    const battle = new Battle(state, 'boss', () => 0.5);
    expect(state.level).toBe(3);
    expect(state.hp).toBe(getStats(state).maxHp);
    expect(state.inventory[state.weapon!]).toBe(1);
    expect(battle.enemies[0].stats.maxHp).toBe(ENEMIES.boss.maxHp);
    expect(battle.enemies[0].hp).toBe(ENEMIES.boss.maxHp);
  });
});
