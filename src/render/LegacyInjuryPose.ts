import type { Bone, Skeleton } from '@esotericsoftware/spine-core';
import { createBody, mobility, PART_CAPACITY, type BodyState } from '../game/body';

/** 傷勢覆蓋動畫的局部骨頭，不改戰鬥數值，也不移除肢體。 */
export class LegacyInjuryPose {
  private body = createBody();

  constructor(private readonly skeleton: Skeleton) {}

  setBody(body: BodyState): void {
    this.body = { ...body };
    const weapon = this.bone('Weapon');
    const parent = this.bone(body.rightArm === 0 && body.leftArm > 0 ? 'LeftFist' : 'RightFist');
    if (weapon.parent !== parent) {
      const previous = weapon.parent!;
      previous.children.splice(previous.children.indexOf(weapon), 1);
      weapon.parent = parent;
      parent.children.push(weapon);
      this.skeleton.updateCache();
    }
    const slots = {
      head: ['Head'],
      chest: ['UpBody'],
      abdomen: ['DownBody'],
      leftArm: ['LeftUpArm', 'LeftDownArm'],
      rightArm: ['RightUpArm', 'RightDownArm'],
      leftLeg: ['LeftBigLeg', 'LeftCalf'],
      rightLeg: ['RightBigLeg', 'RightCalf'],
    };
    for (const [part, names] of Object.entries(slots)) {
      const damaged = body[part as keyof BodyState] < PART_CAPACITY[part as keyof BodyState];
      for (const name of names) {
        this.skeleton
          .findSlot(name)!
          .pose.color.set(damaged ? 0.75 : 1, damaged ? 0.8 : 1, damaged ? 0.65 : 1, 1);
      }
    }
  }

  setPose(moving: boolean, elapsed: number): void {
    const pose = mobility(this.body, moving);
    if (pose === 'seated' || pose === 'crawling') {
      const main = this.bone('Main');
      // Main 位於有旋轉的 root 下，把下降量轉回 root 局部座標。
      const angle = (this.angle(main.parent) * Math.PI) / 180;
      const drop = pose === 'seated' ? 58 : 83;
      main.pose.x -= Math.sin(angle) * drop;
      main.pose.y -= Math.cos(angle) * drop;
      this.setAngle('Body', pose === 'seated' ? 90 : 20);
      this.setAngle('LeftBigLeg', pose === 'seated' ? -20 : 180);
      this.setAngle('RightBigLeg', pose === 'seated' ? -155 : 170);
      this.setAngle('LeftSmallLeg', pose === 'seated' ? -5 : 190);
      this.setAngle('RightSmallLeg', pose === 'seated' ? -175 : 180);
      if (pose === 'crawling') {
        const stride = Math.sin(elapsed * 5) * 18;
        this.setAngle('LeftUpArm', -65 + stride);
        this.setAngle('RightUpArm', -100 - stride);
        this.setAngle('LeftDownArm', -30);
        this.setAngle('RightDownArm', -20);
      }
    } else if (pose === 'limping') {
      const side = this.body.rightLeg === 0 ? 'Right' : 'Left';
      this.setAngle(`${side}BigLeg`, -70);
      this.setAngle(`${side}SmallLeg`, -110);
      this.bone('Body').pose.rotation += moving ? Math.sin(elapsed * 6) * 5 : 4;
    }
    if (this.body.rightArm === 0 && this.body.leftArm > 0 && pose !== 'crawling') {
      const upper = this.angle(this.bone('RightUpArm'));
      const lower = this.angle(this.bone('RightDownArm'));
      this.setAngle('LeftUpArm', upper);
      this.setAngle('LeftDownArm', lower);
    }
    for (const side of ['Left', 'Right'] as const) {
      if (this.body[side === 'Left' ? 'leftArm' : 'rightArm'] === 0) {
        this.setAngle(`${side}UpArm`, -88);
        this.setAngle(`${side}DownArm`, -82);
      }
    }
  }

  private bone(name: string): Bone {
    const bone = this.skeleton.findBone(name);
    if (!bone) {
      throw new Error(`主角骨架缺少 ${name}`);
    }
    return bone;
  }

  private angle(bone: Bone | null): number {
    return bone ? bone.pose.rotation + this.angle(bone.parent) : 0;
  }

  private setAngle(name: string, angle: number): void {
    const bone = this.bone(name);
    bone.pose.rotation = angle - this.angle(bone.parent);
  }
}
