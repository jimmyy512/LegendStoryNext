import { Container, Graphics } from 'pixi.js';
import { mobility, type BodyState } from '../game/body';

/** 傷勢只改姿態與繃帶，不移除肢體，也不使用血液特效。 */
export class CombatantSprite extends Container {
  private moving = false;
  private artwork = new Container();

  constructor(
    private readonly color: number,
    private readonly body: BodyState,
    private readonly hero = false,
  ) {
    super();
    this.addChild(this.artwork);
    this.drawPose();
  }

  setMoving(moving: boolean, elapsed: number): void {
    if (this.moving !== moving) {
      this.moving = moving;
      this.drawPose();
    }
    const pose = mobility(this.body, moving);
    this.artwork.rotation = moving
      ? Math.sin(elapsed * (pose === 'crawling' ? 5 : 12)) * (pose === 'limping' ? 0.1 : 0.025)
      : 0;
    this.artwork.y = moving && pose === 'limping' ? Math.abs(Math.sin(elapsed * 6)) * 3 : 0;
  }

  private drawPose(): void {
    for (const child of this.artwork.removeChildren()) {
      child.destroy({ children: true });
    }
    const pose = mobility(this.body, this.moving);
    const g = new Graphics();
    g.ellipse(0, 5, pose === 'crawling' ? 31 : 19, 7).fill({ color: 0x101e1c, alpha: 0.4 });
    const seated = pose === 'seated';
    if (pose === 'crawling') {
      g.poly([-25, -11, 12, -23, 21, -9, -15, 0]).fill(this.color);
      g.moveTo(-18, -6)
        .lineTo(-33, 0)
        .moveTo(-15, -2)
        .lineTo(-30, 7)
        .stroke({ color: 0x405047, width: 7 });
      g.circle(23, -20, 8).fill(0xd4b995).ellipse(23, -26, 9, 4).fill(0x202f2c);
      g.moveTo(8, -14).lineTo(16, 2).lineTo(25, 3).stroke({ color: this.color, width: 6 });
      g.rect(-25, -3, 6, 5).fill(0xded8bd);
    } else {
      const rise = seated ? 12 : 0;
      if (seated) {
        g.moveTo(-4, -3)
          .lineTo(-19, -4)
          .lineTo(-27, 3)
          .moveTo(4, -3)
          .lineTo(19, -4)
          .lineTo(27, 3)
          .stroke({ color: 0x405047, width: 8 });
        g.rect(-20, -7, 6, 5).fill(0xded8bd).rect(14, -7, 6, 5).fill(0xded8bd);
      } else {
        for (const [x, part] of [
          [-6, 'rightLeg'],
          [6, 'leftLeg'],
        ] as const) {
          g.moveTo(x, -15)
            .lineTo(x + (this.body[part] === 0 ? 5 : 0), -5)
            .lineTo(x, 2)
            .stroke({ color: 0x405047, width: 7 });
          if (this.body[part] < 40) {
            g.rect(x - 4, -11, 8, 4).fill(0xded8bd);
          }
        }
      }
      g.poly([-9, -38 + rise, 9, -38 + rise, 14, -12 + rise, -12, -8 + rise]).fill(this.color);
      g.poly([-7, -36 + rise, 0, -24 + rise, 7, -36 + rise, 2, -13 + rise, -3, -13 + rise]).fill(
        0xded8bd,
      );
      g.rect(-11, -17 + rise, 24, 4).fill(0x7a5745);
      for (const [x, part] of [
        [-11, 'rightArm'],
        [11, 'leftArm'],
      ] as const) {
        const disabled = this.body[part] === 0;
        const handX = disabled ? x * 1.2 : x * 1.7;
        const handY = disabled ? -6 : -18;
        g.moveTo(x, -34 + rise)
          .lineTo(handX, handY + rise)
          .stroke({ color: disabled ? 0x778076 : this.color, width: 7 });
        g.circle(handX, handY + rise, 3).fill(0xd4b995);
        if (this.body[part] < 32) {
          g.moveTo(x, -27 + rise)
            .lineTo(handX, -22 + rise)
            .stroke({ color: 0xe0d8bb, width: 5 });
        }
        if (disabled) {
          g.circle(handX, handY + rise, 5).stroke({ color: 0xd3ac69, width: 1.2 });
        }
      }
      g.circle(0, -45 + rise, 10)
        .fill(0xd4b995)
        .ellipse(0, -51 + rise, 10, 6)
        .fill(0x202f2c);
      g.circle(1, -59 + rise, 5).fill(0x202f2c);
      if (this.body.head < 45) {
        g.rect(-9, -49 + rise, 18, 4).fill(0xe0d8bb);
      }
      if (this.hero) {
        const hand = this.body.rightArm > 0 ? -1 : this.body.leftArm > 0 ? 1 : 0;
        if (hand) {
          g.moveTo(hand * 18, -35 + rise)
            .lineTo(hand * 21, -8 + rise)
            .stroke({ color: 0xd6dacb, width: 2 });
        }
      }
    }
    this.artwork.addChild(g);
  }
}
