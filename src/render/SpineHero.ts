import { Skin, Spine } from '@esotericsoftware/spine-pixi-v8';
import { Container } from 'pixi.js';

export interface HeroAppearance {
  outfit: 'ivory' | 'jade';
  hair: 'topknot' | 'tied';
  weapon: 'plain' | 'jade' | 'none';
}

export type HeroMotion = 'idle' | 'walk' | 'attack' | 'hurt' | 'seated';

/** 只處理 Spine 顯示，裝備能力與傷害仍由遊戲規則決定。 */
export class SpineHero extends Container {
  private actor: Spine;
  private appearance: HeroAppearance = { outfit: 'ivory', hair: 'topknot', weapon: 'plain' };
  private injuredRightArm = false;
  private motion: HeroMotion = 'idle';

  constructor(assets: { skeleton: string; atlas: string }) {
    super();
    this.actor = Spine.from({ ...assets, autoUpdate: false });
    this.addChild(this.actor);
    this.actor.state.data.defaultMix = 0.15;
    this.setAppearance(this.appearance);
    this.playMotion('idle');
  }

  setAppearance(appearance: HeroAppearance): void {
    this.appearance = { ...appearance };
    const skin = new Skin('equipped');
    const names = ['body', `outfit/${appearance.outfit}`, `hair/${appearance.hair}`];
    if (appearance.weapon !== 'none') {
      names.push(`weapon/${appearance.weapon}/${this.injuredRightArm ? 'L' : 'R'}`);
    }
    for (const name of names) {
      const part = this.actor.skeleton.data.findSkin(name);
      if (!part) {
        throw new Error(`角色素材缺少 Skin：${name}`);
      }
      skin.addSkin(part);
    }
    this.actor.skeleton.setSkin(skin);
    // 換到空手或另一隻手時，必須清除前一套 Skin 留在插槽上的武器。
    this.actor.skeleton.setupPoseSlots();
    this.actor.update(0);
  }

  setRightArmInjured(injured: boolean): void {
    this.injuredRightArm = injured;
    this.setAppearance(this.appearance);
    this.playMotion(this.motion);
  }

  playMotion(motion: HeroMotion): void {
    this.motion = motion;
    this.actor.state.clearTracks();
    this.actor.skeleton.setupPose();
    const animation = motion === 'attack' ? `attack${this.injuredRightArm ? 'L' : 'R'}` : motion;
    const once = motion === 'attack' || motion === 'hurt';
    this.actor.state.setAnimation(0, animation, !once);
    if (once) {
      this.actor.state.addAnimation(0, 'idle', true, 0);
    }
    if (this.injuredRightArm) {
      this.actor.state.setAnimation(1, 'injuredR', true);
    }
    this.actor.update(0);
  }

  update(seconds: number): void {
    this.actor.update(seconds);
  }
}
