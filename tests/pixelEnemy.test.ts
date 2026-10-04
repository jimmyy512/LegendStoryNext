import { afterEach, describe, expect, it, vi } from 'vitest';
import { Assets, Sprite, Texture } from 'pixi.js';
import { createBody } from '../src/game/body';
import { PixelEnemy } from '../src/render/PixelEnemy';
import { HumanoidEnemyRig } from '../src/render/HumanoidEnemyRig';

afterEach(() => vi.restoreAllMocks());

describe('enemy anticipation follows combat timing', () => {
  it('holds the boss sword low before thrusting and returns through the planted step', () => {
    vi.spyOn(Assets, 'get').mockImplementation((() => Texture.EMPTY) as typeof Assets.get);
    const enemy = new PixelEnemy('boss', createBody());
    const visibleFrame = () => enemy.children.findIndex((child) => child.visible);
    expect(visibleFrame()).toBe(0);
    enemy.playAttack();
    enemy.update(0.5);
    expect(visibleFrame()).toBe(1);
    enemy.update(1);
    expect(visibleFrame()).toBe(1);
    enemy.playStrike();
    expect(visibleFrame()).toBe(2);
    enemy.update(0.44);
    expect(visibleFrame()).toBe(1);
    enemy.update(0.3);
    expect(visibleFrame()).toBe(0);
    enemy.destroy({ children: true });
  });

  it.each(['disciple', 'zombie', 'boss'])(
    'keeps %s grounded during idle and anticipation',
    (id) => {
      vi.spyOn(Assets, 'get').mockImplementation((() => Texture.EMPTY) as typeof Assets.get);
      const enemy = new PixelEnemy(id, createBody());
      for (let frame = 0; frame < 120; frame++) {
        enemy.update(1 / 60);
        const sprite = enemy.children.find((child) => child.visible) as Sprite;
        expect(sprite.y).toBe(0);
        expect(sprite.anchor.y).toBeLessThan(1);
      }
      enemy.playAttack();
      enemy.update(0.5);
      const sprite = enemy.children.find((child) => child.visible) as Sprite;
      expect(sprite.y).toBe(0);
      enemy.destroy({ children: true });
    },
  );
  function actor() {
    vi.spyOn(Assets, 'get').mockImplementation((() => Texture.EMPTY) as typeof Assets.get);
    const pose = vi.spyOn(HumanoidEnemyRig.prototype, 'pose');
    return { enemy: new PixelEnemy('bandit', createBody()), pose };
  }

  it('holds anticipation until a strike event, then starts at contact during hit pause', () => {
    const { enemy, pose } = actor();
    enemy.playAttack();
    enemy.update(0.4);
    expect(pose).toHaveBeenLastCalledWith('windup', 0.3);
    enemy.update(1.4);
    expect(pose).toHaveBeenLastCalledWith('windup', 0.3);
    enemy.playStrike();
    expect(pose).toHaveBeenLastCalledWith('strike', 0.14);
    enemy.update(0.2);
    expect(pose.mock.lastCall?.[0]).toBe('strike');
    expect(pose.mock.lastCall?.[1]).toBeCloseTo(0.34);
    enemy.update(0.6);
    expect(pose.mock.lastCall?.[0]).toBe('idle');
    enemy.destroy({ children: true });
  });

  it('cancelling anticipation does not play a phantom strike; death cannot be interrupted', () => {
    const { enemy, pose } = actor();
    enemy.playAttack();
    enemy.update(0.4);
    enemy.setPreparing(false);
    enemy.update(0);
    expect(pose.mock.lastCall?.[0]).toBe('idle');
    enemy.setBody(createBody(), 0);
    enemy.update(1);
    expect(pose).toHaveBeenLastCalledWith('down', 0.85);
    enemy.playAttack();
    enemy.playStrike();
    enemy.playHurt();
    enemy.update(1);
    expect(pose).toHaveBeenLastCalledWith('down', 0.85);
    enemy.destroy({ children: true });
  });
});
