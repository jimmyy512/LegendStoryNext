import { Container } from 'pixi.js';
import type { GameState } from '../game/types';
import { HERO_ASSETS, heroAppearance } from './heroAppearance';
import { LegacyHero } from './LegacyHero';

/** 遊戲狀態轉成顯示指令，骨架細節留在 LegacyHero。 */
export class GameHero extends Container {
  private spine = new LegacyHero(HERO_ASSETS);
  private moving = false;
  private attackIndex = 0;

  constructor(state: GameState) {
    super();
    this.spine.scale.set(0.18);
    this.addChild(this.spine);
    this.setState(state);
  }

  setState(state: GameState): void {
    this.spine.setAppearance(heroAppearance(state));
    this.spine.setBody(state.body);
  }

  setMoving(moving: boolean): void {
    if (this.moving !== moving) {
      this.moving = moving;
      this.spine.playMotion(moving ? 'Run' : 'Idle');
    }
  }

  faceDirection(dx: number): void {
    if (Math.abs(dx) > 0.01) {
      this.spine.scale.x = Math.sign(dx) * Math.abs(this.spine.scale.x);
    }
  }

  playAttack(): void {
    const motions = ['NormalAttack1', 'NormalAttack2', 'NormalAttack3'] as const;
    this.spine.playMotion(motions[this.attackIndex++ % motions.length], false);
  }

  update(seconds: number): void {
    if (this.spine.visible) {
      this.spine.update(seconds);
    }
  }
}
