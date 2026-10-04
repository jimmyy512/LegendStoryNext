import { describe, expect, it, vi } from 'vitest';
import { Container } from 'pixi.js';
import { createGame } from '../src/game/state';

vi.mock('../src/render/PixelHeroine', () => ({
  DEFAULT_LOOK: { gear: {} },
  motionDuration: () => 1.6,
  PixelHeroine: class extends Container {
    pose = vi.fn();
    equip = vi.fn();
    setAttackPart = vi.fn();
  },
}));
import { PixelBattleHero } from '../src/render/PixelBattleHero';

describe('hero strike follows simulation events', () => {
  it('keeps the death motion through late combat events and holds its last frame', () => {
    const state = createGame('演武', 'sword');
    const hero = new PixelBattleHero(state);
    const art = hero.children[0] as Container & { pose: ReturnType<typeof vi.fn> };
    hero.playAttack();
    state.hp = 0;
    hero.setState(state);
    hero.playGuard();
    hero.playStrike();
    hero.playHurt();
    hero.setPreparing(false);
    hero.update(0.4);
    expect(art.pose).toHaveBeenLastCalledWith('down', 0.4);
    hero.update(10);
    expect(art.pose).toHaveBeenLastCalledWith('down', 1.6);
    hero.destroy({ children: true });
  });
  it.each([0.45, 0.7])('holds anticipation for a %s second windup until contact', (windup) => {
    const state = createGame('演武', 'sword');
    state.weapon = 'sword';
    const hero = new PixelBattleHero(state);
    const art = hero.children[0] as Container & { pose: ReturnType<typeof vi.fn> };
    hero.playAttack(windup);
    hero.update(windup / 2);
    const before = art.pose.mock.lastCall?.[1] as number;
    hero.update(2);
    const held = art.pose.mock.lastCall?.[1] as number;
    expect(held).toBeGreaterThan(before);
    expect(held).toBeLessThan(0.59);
    hero.playStrike();
    expect(art.pose).toHaveBeenLastCalledWith('attack', 0.59);
    hero.update(0.35);
    expect(art.pose).toHaveBeenLastCalledWith('attack', 1.6);
    hero.update(0.01);
    expect(art.pose.mock.lastCall?.[0]).toBe('idle');
    hero.destroy({ children: true });
  });

  it('releases cancelled anticipation without producing a contact pose', () => {
    const hero = new PixelBattleHero(createGame('演武', 'sword'));
    const art = hero.children[0] as Container & { pose: ReturnType<typeof vi.fn> };
    hero.playAttack();
    hero.update(0.2);
    hero.setPreparing(false);
    hero.update(0.01);
    expect(art.pose.mock.lastCall?.[0]).toBe('idle');
    hero.destroy({ children: true });
  });
});
