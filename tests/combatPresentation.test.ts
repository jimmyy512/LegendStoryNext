import { describe, expect, it, vi } from 'vitest';
import { Container } from 'pixi.js';
import { Battle } from '../src/game/battle';
import { createGame } from '../src/game/state';

vi.mock('../src/render/LegacyHero', () => ({
  LegacyHero: class extends Container {
    playMotion = vi.fn();
    setAppearance = vi.fn();
    setBody = vi.fn();
    update = vi.fn();
  },
}));
import { GameHero } from '../src/render/GameHero';

describe('交鋒呈現與短兵器回歸', () => {
  it('看見重擊再防禦可即時減傷，取消起招不退內力，且不能連按無成本防禦', () => {
    const b = new Battle(createGame('演武', 'sword'), 'boss', () => 0);
    b.enemies[0].position = 14;
    b.enemies[0].actions = 2;
    b.enemies[0].progress = 1;
    b.holdingPosition = true;
    b.playerProgress = 1;
    b.act({ type: 'skill', skill: 'swordfall', target: 0 });
    b.update(0.05);
    expect(b.strike).not.toBeNull();
    const stamina = b.stamina;
    expect(b.act({ type: 'defend' })).toBeNull();
    expect(b.strike).toBeNull();
    expect(b.player.mp).toBe(25);
    expect(b.stamina).toBe(stamina - 20);
    expect(b.act({ type: 'defend' })).not.toBeNull();
    const events = b.update(1.05);
    const hit = events.find((e) => e.kind === 'damage' && e.target === 'player');
    expect(hit?.amount).toBeGreaterThan(0);
    expect(hit?.amount).toBeLessThan(25);
    expect(b.guarding).toBe(false);
  });
  it('起招後的移動狀態更新不會切掉攻擊動畫，結束後再接續跑步', () => {
    const hero = new GameHero(createGame('演武', 'sword'));
    const actor = hero.children[0] as Container & { playMotion: ReturnType<typeof vi.fn> };
    hero.setMoving(true);
    hero.playAttack();
    for (let i = 0; i < 30; i++) {
      hero.setMoving(i % 2 === 0);
      hero.update(0.016);
    }
    expect(actor.playMotion.mock.calls.map((c) => c[0])).toEqual(['Run', 'NormalAttack1']);
    hero.setMoving(true);
    hero.update(0.3);
    expect(actor.playMotion.mock.calls.at(-1)?.[0]).toBe('Run');
  });

  it('敵人在短兵器有效距離內穩住，拳掌連續普攻能實際命中', () => {
    const b = new Battle(createGame('拳掌', 'fist'), 'boss', () => 0);
    b.enemies[0].position = 12.4;
    b.playerPosition = 10;
    b.desiredDistance = 2.4;
    b.paused = false;
    b.update(7);
    const hits = b.events.filter((e) => e.kind === 'damage' && e.source === 'player');
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(b.enemies[0].hp).toBeLessThan(160);
    expect(b.enemies[0].position).toBeCloseTo(12.4);
  });

  it('技能從起招到命中攜帶穩定識別，特效不必分析戰報文字', () => {
    const b = new Battle(createGame('演武', 'sword'), 'boss', () => 0);
    b.enemies[0].position = 14;
    b.holdingPosition = true;
    b.playerProgress = 1;
    b.act({ type: 'skill', skill: 'pierce', target: 0 });
    const events = b.update(0.8);
    expect(events.find((e) => e.kind === 'windup' && e.source === 'player')).toMatchObject({
      skill: 'pierce',
      target: 0,
    });
    expect(events.find((e) => e.kind === 'damage' && e.source === 'player')).toMatchObject({
      skill: 'pierce',
      target: 0,
    });
  });
});
