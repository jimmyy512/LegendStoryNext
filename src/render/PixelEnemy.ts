import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import type { BodyPart, BodyState } from '../game/body';
import { HumanoidEnemyRig } from './HumanoidEnemyRig';

type Motion = 'idle' | 'walk' | 'windup' | 'attack' | 'hurt' | 'guard' | 'down';
type Frame =
  'idle' | 'step' | 'attack' | 'hurt' | 'down' | 'prepare' | 'lift' | 'follow' | 'recover';
type Profile = { scale: number; pace: number; attackTime: number; lunge: number; fallTime: number };

const PROFILES: Record<string, Profile> = {
  disciple: { scale: 0.145, pace: 1.1, attackTime: 0.66, lunge: 22, fallTime: 0.48 },
  bandit: { scale: 0.14, pace: 0.85, attackTime: 0.82, lunge: 33, fallTime: 0.55 },
  zombie: { scale: 0.15, pace: 0.5, attackTime: 1.05, lunge: 15, fallTime: 0.65 },
  boss: { scale: 0.18, pace: 0.72, attackTime: 1.02, lunge: 40, fallTime: 0.85 },
};

/** Registration aligns planted feet across the authored cells, without stretching anatomy. */
const SLASH_SHEETS: Record<string, { scale: number; origins: [number, number][] }> = {
  bandit: {
    scale: 0.395,
    origins: [
      [248, 499],
      [224, 499],
      [224, 498],
      [274, 462],
      [271, 462],
      [264, 466],
    ],
  },
};

// Match the slash sheet's ~179 world-unit standing silhouette. Transparent
// padding must not become a gap between the boots and the stage floor.
const FRAME_REGISTRATION: Record<string, { scale: number; baseline: number }> = {
  'enemy:bandit:hurt': { scale: 0.157, baseline: 1219 / 1295 },
  'enemy:bandit:step': { scale: 0.152, baseline: 1243 / 1295 },
  'enemy:bandit:down': { scale: 0.157, baseline: 473 / 481 },
};

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const easeOut = (value: number): number => 1 - Math.pow(1 - clamp(value), 3);

/** Art-directed frames keep their anatomy intact; timings are reusable across enemies. */
export class PixelEnemy extends Container {
  impactPoint(part: BodyPart): { x: number; y: number } {
    if (this.rig) {
      return this.toLocal(this.rig.impactPoint(part), this.rig);
    }
    const heights = {
      head: -154,
      chest: -109,
      abdomen: -78,
      leftArm: -92,
      rightArm: -92,
      leftLeg: -32,
      rightLeg: -32,
    };
    return { x: 0, y: heights[part] };
  }
  private readonly rig?: HumanoidEnemyRig;
  private travelPhase = 0;
  private travelStrength = 0;
  private travelDirection = 1;
  private readonly frames: Partial<Record<Frame, Sprite>>;
  private readonly hasSlashSequence: boolean;
  private readonly profile: Profile;
  private motion: Motion = 'idle';
  private time = 0;
  private actionRemaining = 0;
  private actionDuration = 0;
  private moving = false;
  private defeated = false;
  private injured = false;
  private preparing = false;

  constructor(id: string, body: BodyState) {
    super();
    const profile = PROFILES[id];
    if (!profile) {
      throw new Error(`Missing enemy animation profile: ${id}`);
    }
    this.profile = profile;
    if (id === 'bandit') {
      this.rig = new HumanoidEnemyRig(Assets.get<Texture>('enemy:bandit:rig'));
      this.rig.scale.set(0.95);
      this.frames = {};
      this.hasSlashSequence = false;
      this.addChild(this.rig);
      this.setBody(body, 1);
      this.update(0);
      return;
    }
    const sheet = SLASH_SHEETS[id];
    this.hasSlashSequence = !!sheet;
    const frame = (key: string): Sprite => {
      const texture = Assets.get<Texture>(key);
      texture.source.scaleMode = 'nearest';
      const sprite = new Sprite(texture);
      const registration = FRAME_REGISTRATION[key];
      sprite.anchor.set(0.5, registration?.baseline ?? 1);
      sprite.scale.set(registration?.scale ?? profile.scale);
      sprite.visible = false;
      this.addChild(sprite);
      return sprite;
    };
    const slashFrame = (index: number): Sprite => {
      const atlas = Assets.get<Texture>(`enemy:${id}:slash-sheet`);
      const sprite = new Sprite(
        new Texture({
          source: atlas.source,
          frame: new Rectangle((index % 3) * 512, Math.floor(index / 3) * 512, 512, 512),
        }),
      );
      sprite.label = `slash:${index}`;
      sprite.texture.source.scaleMode = 'nearest';
      sprite.anchor.set(sheet.origins[index][0] / 512, sheet.origins[index][1] / 512);
      sprite.scale.set(sheet.scale);
      sprite.visible = false;
      this.addChild(sprite);
      return sprite;
    };
    this.frames = {
      idle: sheet ? slashFrame(0) : frame(`enemy:${id}`),
      step: frame(`enemy:${id}:step`),
      attack: sheet ? slashFrame(3) : frame(`enemy:${id}:attack`),
      hurt: frame(`enemy:${id}:hurt`),
      down: frame(`enemy:${id}:down`),
      ...(sheet
        ? {
            prepare: slashFrame(1),
            lift: slashFrame(2),
            follow: slashFrame(4),
            recover: slashFrame(5),
          }
        : {}),
    };
    this.setBody(body, 1);
    this.update(0);
  }

  setBody(body: BodyState, hp: number): void {
    this.rig?.setBody(body);
    this.injured = Object.values(body).some((value) => value === 0);
    if (hp <= 0 && !this.defeated) {
      this.defeated = true;
      this.start('down', this.profile.fallTime);
    }
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
  }

  setTravel(dx: number, dy: number, dt: number): void {
    if (!this.rig || dt <= 0 || this.defeated) {
      return;
    }
    const distance = Math.hypot(dx, dy) / this.rig.scale.x;
    this.travelPhase += (distance / 60) * Math.PI * 2;
    if (Math.abs(dx) > 0.01) {
      this.travelDirection = -Math.sign(dx);
    }
    this.travelStrength +=
      (Math.min(1, distance / dt / 35) - this.travelStrength) * (1 - Math.exp(-24 * dt));
    this.rig.setTravel(this.travelPhase, this.travelStrength, this.travelDirection);
  }

  setPreparing(preparing: boolean): void {
    this.preparing = preparing;
    if (!preparing && this.motion === 'windup') {
      this.actionRemaining = 0;
    }
  }

  faceDirection(_dx: number): void {
    // The authored enemy frames face the player at stage left.
  }

  playAttack(): void {
    if (!this.defeated) {
      this.preparing = true;
      this.start('windup', 0.24);
    }
  }

  playStrike(): void {
    if (this.defeated) {
      return;
    }
    this.preparing = false;
    this.start('attack', this.profile.attackTime);
    this.actionRemaining = this.profile.attackTime * 0.61;
    // Hit pause begins on the same event; freeze the contact pose, not windup.
    this.update(0);
  }

  playGuard(): void {
    if (!this.defeated) {
      this.start('guard', 0.5);
    }
  }

  playHurt(): void {
    if (!this.defeated) {
      this.start('hurt', 0.38);
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.actionRemaining = Math.max(0, this.actionRemaining - dt);
    if (!this.defeated && this.actionRemaining === 0) {
      this.motion = this.preparing ? 'windup' : this.moving ? 'walk' : 'idle';
    }
    const phase = this.actionDuration ? clamp(1 - this.actionRemaining / this.actionDuration) : 0;
    if (this.rig) {
      const motion = this.motion === 'attack' ? 'strike' : this.motion;
      const sample =
        motion === 'strike'
          ? 0.14 + Math.max(0, this.profile.attackTime * 0.61 - this.actionRemaining)
          : motion === 'windup'
            ? phase * 0.3
            : motion === 'down'
              ? phase * 0.85
              : motion === 'hurt' || motion === 'guard'
                ? phase * this.actionDuration
                : this.time;
      this.rig.pose(motion, sample);
      return;
    }
    const walking = Math.sin(this.time * this.profile.pace * 9);
    const breathing = Math.sin(this.time * this.profile.pace * 2.8);
    let name: Frame = 'idle';
    let x = 0;
    let y = 0;
    let tint = this.injured ? 0xffe5db : 0xffffff;
    if (this.motion === 'walk') {
      // Alternate authored stance and planted step; neither frame is warped.
      name = walking > 0.08 ? 'step' : 'idle';
      y = -Math.abs(walking) * 1.5;
    } else if (this.motion === 'idle') {
      y = -Math.max(0, breathing) * 1.3;
    } else if (this.motion === 'windup') {
      // Hold anticipation until the combat simulation resolves the strike.
      x = easeOut(phase) * 7;
      y = -Math.max(0, breathing) * 0.5;
      if (this.hasSlashSequence) {
        name = phase < 0.55 ? 'prepare' : 'lift';
        x = 0;
        y = 0;
      }
    } else if (this.motion === 'attack') {
      if (phase < 0.3) {
        x = easeOut(phase / 0.3) * 7;
      } else if (phase < 0.79) {
        name = 'attack';
        x = 7 - easeOut((phase - 0.3) / 0.18) * this.profile.lunge;
      } else {
        x = -(this.profile.lunge - 7) * (1 - easeOut((phase - 0.79) / 0.21));
      }
      if (this.hasSlashSequence) {
        name = phase < 0.56 ? 'attack' : phase < 0.8 ? 'follow' : 'recover';
        x = 0;
      }
    } else if (this.motion === 'hurt') {
      name = phase < 0.9 ? 'hurt' : 'idle';
      x = easeOut(Math.min(phase / 0.25, 1)) * 17 * (1 - easeOut((phase - 0.25) / 0.75));
      y = -Math.sin(Math.PI * phase) * 2;
      tint = phase < 0.16 ? 0xffb8a3 : tint;
    } else if (this.motion === 'guard') {
      x = 5;
    } else if (this.motion === 'down') {
      // The collapse has its own authored grounded image. The boss stays kneeling.
      name = phase < 0.27 ? 'hurt' : 'down';
      x = easeOut(phase) * (this.profile.lunge * 0.34);
      y = phase < 0.27 ? -Math.sin((phase / 0.27) * Math.PI) * 3 : 2;
      tint = 0xffffff;
    }
    for (const [key, sprite] of Object.entries(this.frames)) {
      sprite.visible = key === name;
      if (sprite.visible) {
        sprite.position.set(x, y);
        sprite.tint = tint;
        sprite.alpha = this.motion === 'down' ? 0.85 : 1;
      }
    }
  }

  private start(motion: Motion, duration: number): void {
    this.motion = motion;
    this.actionDuration = duration;
    this.actionRemaining = duration;
  }
}
