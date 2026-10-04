import { afterEach, describe, expect, it, vi } from 'vitest';
import { Assets, Sprite, Texture } from 'pixi.js';
import { PixelWorldActor } from '../src/render/PixelWorldActor';

afterEach(() => vi.restoreAllMocks());
describe('大地圖 NPC 待機', () => {
  it('跨呼吸週期與姿勢切換時，腳底與腰線保持固定', () => {
    vi.spyOn(Assets, 'get').mockImplementation((() => Texture.EMPTY) as typeof Assets.get);
    const actor = new PixelWorldActor('npc', 'qing', 0.052);
    actor.position.set(120, 180);
    for (let frame = 0; frame < 600; frame++) {
      actor.update(1 / 60);
      const pose = actor.children.find((child) => child.visible)!;
      const lower = pose.getChildByLabel('planted-lower-body') as Sprite;
      const upper = pose.getChildByLabel('breathing-upper-body') as Sprite;
      const foot = lower.toGlobal({ x: 0, y: 0 });
      expect(foot.x).toBeCloseTo(120);
      expect(foot.y).toBeCloseTo(180);
      const waist = upper.toGlobal({ x: 0, y: -Texture.EMPTY.height * 0.38 });
      expect(waist.y).toBeCloseTo(180 - 62 * 0.38);
      expect(lower.rotation).toBe(0);
    }
    actor.destroy({ children: true });
  });
  it('倒地傷者沒有站立呼吸的上下位移', () => {
    vi.spyOn(Assets, 'get').mockImplementation((() => Texture.EMPTY) as typeof Assets.get);
    const actor = new PixelWorldActor('enemy', 'bandit', 0.05, true);
    actor.update(0.5);
    const upper = actor.getChildByLabel('breathing-upper-body', true) as Sprite;
    expect(upper.y).toBe(0);
    expect(upper.scale.y).toBe(0.05);
    actor.destroy({ children: true });
  });
});
