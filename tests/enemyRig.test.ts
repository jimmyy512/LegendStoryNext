import { describe, expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import { BANDIT_RIG_SKIN, HumanoidEnemyRig } from '../src/render/HumanoidEnemyRig';
import { createBody } from '../src/game/body';

describe('enemy weapon release', () => {
  it('換手後持刀跟隨可用手，雙手失能時不再持刀揮砍', () => {
    const rig = new HumanoidEnemyRig(Texture.EMPTY);
    const blade = rig.getChildByLabel('held-weapon', true)!;
    const rightGrip = blade.parent;
    const body = createBody();
    body.rightArm = 0;
    rig.setBody(body);
    expect(blade.parent).not.toBe(rightGrip);
    rig.pose('strike', 0.14);
    expect(blade.visible).toBe(true);
    body.leftArm = 0;
    rig.setBody(body);
    rig.pose('strike', 0.14);
    expect(blade.visible).toBe(false);
    body.rightArm = 32;
    rig.setBody(body);
    rig.pose('idle', 0);
    expect(blade.parent).toBe(rightGrip);
    expect(blade.visible).toBe(true);
    rig.destroy({ children: true });
  });
  it('換手持刀後倒地，武器仍由實際握柄位置落下', () => {
    const rig = new HumanoidEnemyRig(Texture.EMPTY);
    const body = createBody();
    body.rightArm = 0;
    body.leftLeg = 0;
    rig.setBody(body);
    const held = rig.getChildByLabel('held-weapon', true)!;
    const dropped = rig.getChildByLabel('dropped-weapon', true)!;
    rig.pose('down', 0.3 - 0.000001);
    const grip = rig.toLocal({ x: 0, y: 0 }, held);
    rig.pose('down', 0.3);
    const released = rig.toLocal({ x: 0, y: 0 }, dropped);
    expect(Math.hypot(grip.x - released.x, grip.y - released.y)).toBeLessThan(0.001);
    rig.destroy({ children: true });
  });
  it('keeps hit anchors attached while the body falls', () => {
    const rig = new HumanoidEnemyRig(Texture.EMPTY);
    const head = rig.impactPoint('head');
    expect(head.y).toBeLessThan(rig.impactPoint('chest').y);
    expect(rig.impactPoint('chest').y).toBeLessThan(rig.impactPoint('abdomen').y);
    expect(rig.impactPoint('abdomen').y).toBeLessThan(rig.impactPoint('rightLeg').y);
    rig.pose('down', 0.6);
    expect(rig.impactPoint('head').y).toBeGreaterThan(head.y + 30);
    rig.destroy({ children: true });
  });
  for (const arm of [BANDIT_RIG_SKIN.arm, { upper: 33, fore: 37 }]) {
    it(`keeps the weapon continuous for ${arm.upper}/${arm.fore} arm lengths`, () => {
      const rig = new HumanoidEnemyRig(Texture.EMPTY, { ...BANDIT_RIG_SKIN, arm });
      const held = rig.getChildByLabel('held-weapon', true)!;
      const dropped = rig.getChildByLabel('dropped-weapon', true)!;
      rig.pose('down', 0.3 - 0.000001);
      const grip = rig.toLocal({ x: 0, y: 0 }, held);
      const tip = rig.toLocal({ x: 0, y: -50 }, held);
      expect(held.visible).toBe(true);
      rig.pose('down', 0.3);
      const releasedGrip = rig.toLocal({ x: 0, y: 0 }, dropped);
      const releasedTip = rig.toLocal({ x: 0, y: -50 }, dropped);
      expect(Math.hypot(grip.x - releasedGrip.x, grip.y - releasedGrip.y)).toBeLessThan(0.001);
      expect(Math.hypot(tip.x - releasedTip.x, tip.y - releasedTip.y)).toBeLessThan(0.001);
      expect(held.visible).toBe(false);
      expect(dropped.visible).toBe(true);
      rig.pose('down', 1.2);
      expect(dropped.position.x).toBe(-56);
      expect(dropped.position.y).toBe(-8);
      rig.destroy({ children: true });
    });
  }
});
