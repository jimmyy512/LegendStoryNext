import { afterEach, describe, expect, it, vi } from 'vitest';
import { Assets, Sprite, Texture } from 'pixi.js';
import { PixelWorldActor } from '../src/render/PixelWorldActor';

vi.mock('../src/data/npcFrames', () => ({
  NPC_FRAMES: { qing: { idle: 4 }, master: { gesture: 4 } },
}));

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
  it('有逐格待機的 NPC 依序播放影格，不疊加呼吸縮放', () => {
    const frames = [0, 1, 2, 3].map(() => new Texture());
    vi.spyOn(Assets, 'get').mockImplementation(((key: string) => {
      const match = /^npc:qing:idle:(\d)$/.exec(key);
      return match ? frames[Number(match[1])] : Texture.EMPTY;
    }) as typeof Assets.get);
    const actor = new PixelWorldActor('npc', 'qing', 0.052);
    const still = actor.getChildByLabel('still-pose')!;
    const upper = still.getChildByLabel('breathing-upper-body') as Sprite;
    const seen = new Set<Texture>();
    for (let frame = 0; frame < 120; frame++) {
      actor.update(1 / 60);
      if (still.visible) {
        seen.add(upper.texture);
      }
      expect(upper.y).toBe(0);
    }
    expect(seen.size).toBe(4);
    actor.destroy({ children: true });
  });
  it('逐格手勢依起手、半途、停留、收回的順序播放後回到待機', () => {
    const frames = [0, 1, 2, 3].map(() => new Texture());
    vi.spyOn(Assets, 'get').mockImplementation(((key: string) => {
      const match = /^npc:master:gesture:(\d)$/.exec(key);
      return match ? frames[Number(match[1])] : Texture.EMPTY;
    }) as typeof Assets.get);
    const actor = new PixelWorldActor('npc', 'master', 0.052);
    const gesture = actor.getChildByLabel('gesture-pose')!;
    const upper = gesture.getChildByLabel('breathing-upper-body') as Sprite;
    actor.playGesture();
    const order: Texture[] = [];
    for (let frame = 0; frame < 60; frame++) {
      actor.update(1 / 60);
      if (gesture.visible && order.at(-1) !== upper.texture) {
        order.push(upper.texture);
      }
    }
    expect(order).toEqual(frames);
    expect(gesture.visible).toBe(false);
    actor.destroy({ children: true });
  });
  it('玩家靠近時轉身面向玩家，離開後轉回素材朝向', () => {
    vi.spyOn(Assets, 'get').mockImplementation((() => Texture.EMPTY) as typeof Assets.get);
    const sect = new PixelWorldActor('npc', 'qing', 0.052);
    const roadside = new PixelWorldActor('npc', 'chance-suyin', 0.052);
    const settle = () => {
      for (let frame = 0; frame < 30; frame++) {
        sect.update(1 / 60);
        roadside.update(1 / 60);
      }
    };
    // 門派人物素材朝左、路邊人物朝右；玩家在右側時兩人都看向右邊。
    sect.lookAt(40);
    roadside.lookAt(40);
    settle();
    expect(sect.scale.x).toBe(-1);
    expect(roadside.scale.x).toBe(1);
    sect.lookAt(null);
    roadside.lookAt(-40);
    settle();
    expect(sect.scale.x).toBe(1);
    expect(roadside.scale.x).toBe(-1);
    sect.destroy({ children: true });
    roadside.destroy({ children: true });
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
