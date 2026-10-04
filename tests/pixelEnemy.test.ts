import { afterEach, describe, expect, it, vi } from 'vitest';
import { Assets, Texture } from 'pixi.js';
import { createBody } from '../src/game/body';
import { PixelEnemy } from '../src/render/PixelEnemy';
import { HumanoidEnemyRig } from '../src/render/HumanoidEnemyRig';

afterEach(() => vi.restoreAllMocks());

describe('enemy anticipation follows combat timing', () => {
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
