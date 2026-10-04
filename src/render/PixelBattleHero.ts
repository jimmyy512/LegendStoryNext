import { Container } from 'pixi.js';
import type { BodyPart } from '../game/body';
import type { GameState } from '../game/types';
import {
  DEFAULT_LOOK,
  motionDuration,
  PixelHeroine,
  type PixelInjury,
  type PixelLook,
} from './PixelHeroine';

const BASE = `${import.meta.env.BASE_URL}assets/characters/pixelHeroine/`;

/** 戰鬥規則只傳角色狀態；像素骨架在此轉換裝備、傷勢與動作。 */
export class PixelBattleHero extends Container {
  impactPoint(part: BodyPart): { x: number; y: number } {
    return this.toLocal(this.heroine.impactPoint(part), this.heroine);
  }
  private readonly heroine = new PixelHeroine(BASE);
  private look: PixelLook = { ...DEFAULT_LOOK, gear: { ...DEFAULT_LOOK.gear } };
  private injury: PixelInjury = 'healthy';
  private bodyKey = '';
  private motion: 'idle' | 'run' | 'attack' | 'hurt' | 'down' = 'idle';
  private motionTime = 0;
  private actionRemaining = 0;
  private moving = false;
  private defeated = false;
  private preparing = false;
  private windupDuration = 0.45;
  private attackElapsed = 0;
  private travelPhase = 0;
  private travelStrength = 0;
  private travelDirection = 1;

  setTravel(dx: number, dy: number, dt: number): void {
    if (dt <= 0 || this.defeated) {
      return;
    }
    const distance = Math.hypot(dx, dy);
    this.travelPhase = (this.travelPhase + distance / 60) % 1;
    if (Math.abs(dx) > 0.01) {
      this.travelDirection = Math.sign(dx);
    }
    const target = Math.min(1, distance / dt / 35);
    this.travelStrength += (target - this.travelStrength) * (1 - Math.exp(-24 * dt));
    this.heroine.setFootwork(this.travelPhase, this.travelStrength, this.travelDirection);
  }

  private get contactTime(): number {
    return this.look.weapon === 'sword' ? 0.59 : this.look.weapon === 'knuckles' ? 0.46 : 0.63;
  }

  constructor(state: GameState, options: { showInjuryTint?: boolean } = {}) {
    super();
    this.heroine.showInjuryTint = options.showInjuryTint ?? true;
    this.addChild(this.heroine);
    this.setState(state);
    this.heroine.pose('idle', 0);
  }

  setState(state: GameState): void {
    const look: PixelLook = {
      ...this.look,
      outfit: state.armor === 'robe' ? 'jade' : 'ivory',
      pants: state.pants === 'guardPants' ? 'greaves' : 'ink',
      boots: state.boots === 'swiftBoots' ? 'black' : 'brown',
      weapon: state.weapon === 'sword' ? 'sword' : state.weapon === 'wraps' ? 'knuckles' : 'none',
      hairStyle: state.hair === 'Hair2' ? 'bun' : 'ponytail',
      gear: {
        ...this.look.gear,
        armor: state.armor === 'armor' ? 'lamellar' : 'none',
        headwear:
          state.headwear === 'strawHat'
            ? 'straw'
            : state.headwear === 'taoistCrown'
              ? 'crown'
              : 'none',
      },
    };
    const injury: PixelInjury =
      state.body.rightArm === 0 ? 'disabled' : state.body.rightArm < 32 ? 'hurt' : 'healthy';
    const bodyKey = JSON.stringify(state.body);
    if (
      JSON.stringify(look) !== JSON.stringify(this.look) ||
      injury !== this.injury ||
      bodyKey !== this.bodyKey
    ) {
      this.look = look;
      this.injury = injury;
      this.bodyKey = bodyKey;
      this.heroine.equip(look, injury, state.body);
    }
    if (state.hp <= 0 && !this.defeated) {
      this.defeated = true;
      this.start('down', motionDuration('down', this.look.weapon));
    }
  }

  setMoving(moving: boolean): void {
    this.moving = moving;
  }

  faceDirection(dx: number): void {
    if (Math.abs(dx) > 0.01) {
      this.heroine.scale.x = Math.sign(dx) * Math.abs(this.heroine.scale.x);
    }
  }

  playAttack(windup = 0.45, part: BodyPart = 'chest'): void {
    if (this.defeated) {
      return;
    }
    this.preparing = true;
    this.heroine.setAttackPart(part);
    this.windupDuration = windup;
    this.attackElapsed = 0;
    this.start('attack', windup);
  }

  setPreparing(preparing: boolean): void {
    if (!preparing && this.preparing) {
      this.preparing = false;
      this.actionRemaining = 0;
    }
  }

  playStrike(): void {
    if (this.defeated) {
      return;
    }
    this.preparing = false;
    this.start('attack', 0.35);
    this.attackElapsed = 0;
    this.motionTime = this.contactTime;
    this.heroine.pose('attack', this.motionTime);
  }

  playGuard(): void {
    this.preparing = false;
    this.actionRemaining = 0;
    this.motion = 'idle';
    this.motionTime = 0;
  }

  playHurt(): void {
    if (!this.defeated) {
      this.preparing = false;
      this.start('hurt', 0.35);
    }
  }

  update(dt: number): void {
    if (!this.defeated && !this.preparing && this.actionRemaining <= 0) {
      const next = this.moving ? 'run' : 'idle';
      if (this.motion !== next) {
        this.motion = next;
        this.motionTime = 0;
      }
    }
    const duration = motionDuration(this.motion, this.look.weapon);
    if (this.motion === 'attack') {
      this.attackElapsed += dt;
      this.motionTime = this.preparing
        ? (this.contactTime - 1 / 24) * Math.min(1, this.attackElapsed / this.windupDuration)
        : this.contactTime + (duration - this.contactTime) * Math.min(1, this.attackElapsed / 0.35);
    } else {
      this.motionTime += dt * (this.motion === 'hurt' ? duration / 0.35 : 1);
    }
    this.heroine.pose(
      this.motion,
      this.motion === 'idle' || this.motion === 'run'
        ? this.motionTime % duration
        : Math.min(duration, this.motionTime),
    );
    this.actionRemaining = Math.max(0, this.actionRemaining - dt);
  }

  private start(motion: typeof this.motion, duration: number): void {
    this.motion = motion;
    this.motionTime = 0;
    this.actionRemaining = duration;
  }
}
