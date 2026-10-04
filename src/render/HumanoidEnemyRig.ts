import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { createBody, type BodyPart, type BodyState } from '../game/body';

type Point = readonly [number, number];
type Part = {
  rect: readonly [number, number, number, number];
  pivot: Point;
  scale: number;
  tip?: Point;
};
export type EnemyRigMotion = 'idle' | 'walk' | 'windup' | 'strike' | 'hurt' | 'guard' | 'down';

/** Atlas registration is skin data; hierarchy and movement are shared by humanoid skins. */
export type HumanoidEnemySkin = {
  parts: Record<string, Part>;
  arm: { upper: number; fore: number };
  leg: { thigh: number; shin: number };
};

export const BANDIT_RIG_SKIN: HumanoidEnemySkin = {
  arm: { upper: 25, fore: 29 },
  leg: { thigh: 36, shin: 32 },
  parts: {
    head: { rect: [8, 38, 327, 310], pivot: [148, 286], scale: 0.26 },
    torso: { rect: [342, 117, 267, 234], pivot: [139, 205], scale: 0.24 },
    skirt: { rect: [626, 143, 334, 224], pivot: [141, 35], scale: 0.22 },
    weapon: { rect: [979, 16, 263, 366], pivot: [217, 250], scale: 0.25 },
    upperNear: { rect: [87, 387, 149, 238], pivot: [77, 83], tip: [87, 191], scale: 0.24 },
    foreNear: { rect: [414, 392, 122, 240], pivot: [39, 50], tip: [60, 203], scale: 0.2 },
    handNear: { rect: [701, 442, 171, 187], pivot: [106, 71], scale: 0.15 },
    upperFar: { rect: [1016, 385, 177, 240], pivot: [73, 87], tip: [122, 188], scale: 0.24 },
    foreFar: { rect: [91, 685, 139, 226], pivot: [89, 48], tip: [42, 192], scale: 0.2 },
    handFar: { rect: [393, 700, 148, 214], pivot: [87, 69], scale: 0.15 },
    thighNear: { rect: [656, 661, 227, 268], pivot: [143, 44], tip: [100, 232], scale: 0.2 },
    thighFar: { rect: [991, 659, 224, 265], pivot: [82, 44], tip: [144, 233], scale: 0.2 },
    shinNear: { rect: [96, 950, 133, 249], pivot: [64, 43], tip: [67, 216], scale: 0.17 },
    shinFar: { rect: [397, 950, 145, 246], pivot: [70, 44], tip: [61, 214], scale: 0.17 },
    bootNear: { rect: [679, 1033, 192, 160], pivot: [147, 48], scale: 0.21 },
    bootFar: { rect: [1008, 1033, 209, 163], pivot: [151, 48], scale: 0.21 },
  },
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const v = Math.max(0, Math.min(1, t));
  return v * v * (3 - 2 * v);
};

/** Real articulated hierarchy: pelvis → torso/head/arms and thigh → shin → foot. */
export class HumanoidEnemyRig extends Container {
  private pelvis = new Container();
  private torso = new Container();
  private head = new Container();
  private nearArm = this.chain();
  private farArm = this.chain();
  private nearLeg = this.chain();
  private farLeg = this.chain();
  private blade = new Container();
  private droppedBlade = new Container();
  private releasePosition = { x: 0, y: 0 };
  private travel: { phase: number; strength: number; direction: number } | null = null;
  private body = createBody();
  private lastPose: { motion: EnemyRigMotion; time: number } = { motion: 'idle', time: 0 };

  setBody(body: BodyState): void {
    const changed = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg'].some(
      (part) => (this.body[part as BodyPart] === 0) !== (body[part as BodyPart] === 0),
    );
    this.body = { ...body };
    if (!changed) {
      return;
    }
    const previous = this.lastPose;
    this.pose('down', 0.3);
    this.releasePosition = this.toLocal({ x: 0, y: 0 }, this.blade);
    this.pose(previous.motion, previous.time);
  }

  setTravel(phase: number, strength: number, direction: number): void {
    this.travel = { phase, strength, direction };
  }

  impactPoint(part: BodyPart): { x: number; y: number } {
    const anchor = {
      head: [this.head, -8, -30],
      chest: [this.torso, 0, -29],
      abdomen: [this.torso, 0, -6],
      leftArm: [this.farArm.lower, 0, this.skin.arm.fore / 2],
      rightArm: [this.nearArm.lower, 0, this.skin.arm.fore / 2],
      leftLeg: [this.farLeg.lower, 0, this.skin.leg.shin / 2],
      rightLeg: [this.nearLeg.lower, 0, this.skin.leg.shin / 2],
    } as const;
    const [bone, x, y] = anchor[part];
    return this.toLocal({ x, y }, bone);
  }

  private chain() {
    return { upper: new Container(), lower: new Container(), end: new Container() };
  }

  constructor(
    texture: Texture,
    private readonly skin: HumanoidEnemySkin = BANDIT_RIG_SKIN,
  ) {
    super();
    texture.source.scaleMode = 'nearest';
    const attach = (name: string, parent: Container, length?: number) => {
      const part = skin.parts[name];
      const sprite = new Sprite(
        new Texture({ source: texture.source, frame: new Rectangle(...part.rect) }),
      );
      sprite.pivot.set(...part.pivot);
      sprite.scale.set(part.scale);
      if (part.tip && length !== undefined) {
        const dx = part.tip[0] - part.pivot[0],
          dy = part.tip[1] - part.pivot[1];
        sprite.rotation = Math.PI / 2 - Math.atan2(dy, dx);
        sprite.scale.set(length / Math.hypot(dx, dy));
      }
      parent.addChild(sprite);
    };
    this.addChild(this.pelvis);
    for (const [chain, prefix, length] of [
      [this.farLeg, 'Far', skin.leg.thigh],
      [this.nearLeg, 'Near', skin.leg.thigh],
    ] as const) {
      this.pelvis.addChild(chain.upper);
      attach(`thigh${prefix}`, chain.upper, length);
      chain.upper.addChild(chain.lower);
      chain.lower.y = length;
      attach(`shin${prefix}`, chain.lower, skin.leg.shin);
      chain.lower.addChild(chain.end);
      chain.end.y = skin.leg.shin;
      attach(`boot${prefix}`, chain.end);
    }
    this.pelvis.addChild(this.torso);
    this.torso.addChild(this.farArm.upper);
    attach('torso', this.torso);
    this.torso.addChild(this.head);
    attach('head', this.head);
    attach('skirt', this.pelvis);
    this.torso.addChild(this.nearArm.upper);
    for (const [chain, prefix] of [
      [this.farArm, 'Far'],
      [this.nearArm, 'Near'],
    ] as const) {
      attach(`upper${prefix}`, chain.upper, skin.arm.upper);
      chain.upper.addChild(chain.lower);
      chain.lower.y = skin.arm.upper;
      attach(`fore${prefix}`, chain.lower, skin.arm.fore);
      chain.lower.addChild(chain.end);
      chain.end.y = skin.arm.fore;
      attach(`hand${prefix}`, chain.end);
    }
    this.nearArm.end.addChild(this.blade);
    this.blade.label = 'held-weapon';
    attach('weapon', this.blade);
    this.addChild(this.droppedBlade);
    this.droppedBlade.label = 'dropped-weapon';
    attach('weapon', this.droppedBlade);
    // Sample the authored release pose through the actual hierarchy. Skin bone
    // lengths can vary, so a fixed screen-space release point would teleport.
    this.pose('down', 0.3);
    this.releasePosition = this.toLocal({ x: 0, y: 0 }, this.blade);
    this.pose('idle', 0);
  }

  pose(motion: EnemyRigMotion, time: number): void {
    this.lastPose = { motion, time };
    const wave = Math.sin(time * 2.5);
    const gait = time * 5.5;
    let crouch = 0,
      lean = -0.04,
      head = 0.04;
    let near = 0.6,
      nearElbow = 0.5,
      far = -0.35,
      farElbow = 0.7,
      blade = 0.85;
    let collapse = 0;
    let fall = 0;
    if (motion === 'windup') {
      const t = smooth(time / 0.3);
      near = mix(0.6, -2.2, t);
      nearElbow = mix(0.5, 0.9, t);
      lean = mix(-0.04, 0.12, t);
      crouch = 3 * t;
      blade = mix(0.85, 0.7, t);
    } else if (motion === 'strike') {
      const t = smooth(time / 0.14),
        recover = smooth((time - 0.25) / 0.35);
      near = mix(mix(-2.2, 1.7, t), 0.6, recover);
      nearElbow = mix(mix(0.9, -0.3, t), 0.5, recover);
      lean = mix(-0.17, -0.04, recover);
      crouch = 4 * (1 - recover);
      blade = mix(mix(0.7, -1, t), 0.85, recover);
    } else if (motion === 'guard') {
      near = 1.2;
      nearElbow = 1.2;
      far = 0.9;
      farElbow = 1;
      crouch = 5;
      blade = 0.4;
    } else if (motion === 'hurt') {
      const hit = Math.sin(Math.min(1, time / 0.38) * Math.PI);
      lean = 0.22 * hit;
      head = -0.15 * hit;
      near = 0.4;
      far = -0.65;
      crouch = 5 * hit;
    } else if (motion === 'down') {
      collapse = smooth(time / 0.8);
      fall = smooth((time - 0.2) / 0.55);
      crouch = collapse * 59;
      lean = Math.sin(collapse * Math.PI) * 0.12;
      head = -collapse * 0.1;
      near = mix(0.6, -0.65, collapse);
      nearElbow = mix(0.5, 0.4, collapse);
      far = mix(-0.35, 0.62, collapse);
      farElbow = mix(0.7, -0.45, collapse);
    }
    const rightHand = this.body.rightArm > 0;
    const leftHand = this.body.leftArm > 0;
    const legs = Number(this.body.rightLeg > 0) + Number(this.body.leftLeg > 0);
    if (motion !== 'down') {
      crouch += legs === 0 ? 28 : legs === 1 ? 6 : 0;
      if (!rightHand && leftHand) {
        far = near;
        farElbow = nearElbow;
      }
      if (!rightHand) {
        near = 0.12;
        nearElbow = 0.08;
      }
      if (!leftHand) {
        far = -0.12;
        farElbow = 0.08;
      }
    }
    const grip = rightHand || !leftHand ? this.nearArm.end : this.farArm.end;
    if (this.blade.parent !== grip) {
      grip.addChild(this.blade);
    }
    this.pelvis.position.set(collapse * 12, -80 + crouch + (motion === 'idle' ? wave * 0.7 : 0));
    this.pelvis.rotation = fall * 1.48;
    this.torso.rotation = lean;
    this.head.position.set(-2, -44);
    this.head.rotation = head;
    this.nearArm.upper.position.set(-15, -34);
    this.farArm.upper.position.set(21, -37);
    this.nearArm.upper.rotation = near;
    this.nearArm.lower.rotation = nearElbow;
    this.farArm.upper.rotation = far;
    this.farArm.lower.rotation = farElbow;
    // Blade direction is authored in world space so elbow rotation cannot invert a tell.
    this.blade.rotation =
      blade -
      (grip === this.nearArm.end ? near + nearElbow : far + farElbow) -
      lean -
      this.pelvis.rotation;
    const released = motion === 'down' && time >= 0.3;
    this.blade.visible = !released && (rightHand || leftHand);
    this.droppedBlade.visible = released;
    if (released) {
      const drop = smooth((time - 0.3) / 0.3);
      this.droppedBlade.position.set(
        mix(this.releasePosition.x, -56, drop),
        mix(this.releasePosition.y, -8, drop),
      );
      this.droppedBlade.rotation = mix(0.85, -0.85, drop);
    }
    for (const [chain, side] of [
      [this.nearLeg, -1],
      [this.farLeg, 1],
    ] as const) {
      const phase = (this.travel?.phase ?? gait) + (side > 0 ? Math.PI : 0);
      const injuredLeg = side < 0 ? this.body.rightLeg === 0 : this.body.leftLeg === 0;
      const stride =
        motion === 'down' || legs === 0
          ? 0
          : (this.travel?.strength ?? (motion === 'walk' ? 1 : 0)) * (legs === 1 ? 0.55 : 1);
      const direction = this.travel?.direction ?? 1;
      let footX = mix(
        side * 21 + Math.cos(phase) * 14 * stride * direction,
        side < 0 ? -50 : -42,
        fall,
      );
      let footY = -18 - Math.max(0, Math.sin(phase)) * (injuredLeg ? 2 : 9) * stride;
      if (motion !== 'down' && legs === 1 && injuredLeg) {
        footY -= 8;
      }
      if (
        motion === 'strike' &&
        !rightHand &&
        !leftHand &&
        !injuredLeg &&
        (side < 0 || this.body.rightLeg === 0)
      ) {
        const kick = Math.sin(Math.min(1, time / 0.45) * Math.PI);
        footX -= 34 * kick;
        footY -= 28 * kick;
      }
      chain.upper.position.set(side * 9, 0);
      const dx = footX - side * 9 * Math.cos(this.pelvis.rotation),
        dy = footY - this.pelvis.y - side * 9 * Math.sin(this.pelvis.rotation);
      const a = this.skin.leg.thigh,
        b = this.skin.leg.shin;
      const distance = Math.min(a + b - 0.1, Math.max(Math.abs(a - b) + 0.1, Math.hypot(dx, dy)));
      const bend = Math.acos((a * a + distance * distance - b * b) / (2 * a * distance));
      const upper = Math.atan2(dy, dx) - Math.PI / 2 + bend;
      const knee = Math.PI - Math.acos((a * a + b * b - distance * distance) / (2 * a * b));
      chain.upper.rotation = upper - this.pelvis.rotation;
      chain.lower.rotation = -knee;
      chain.end.rotation =
        fall * 0.5 - chain.upper.rotation - chain.lower.rotation - this.pelvis.rotation;
    }
  }
}
