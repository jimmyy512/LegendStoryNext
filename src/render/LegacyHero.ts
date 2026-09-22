import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Container } from 'pixi.js';
import { createBody, mobility, type BodyState } from '../game/body';
import { LegacyInjuryPose } from './LegacyInjuryPose';

export interface LegacyAppearance {
  outfit: 'farmer' | 'quanzhen' | 'blue';
  hair: 'Hair1' | 'Hair2' | 'Hair3' | 'Hair4';
  weapon: 'Sword' | 'Knife' | 'none';
}

export const LEGACY_MOTIONS = [
  'Idle',
  'Run',
  'NormalAttack1',
  'NormalAttack2',
  'NormalAttack3',
] as const;
export type LegacyMotion = (typeof LEGACY_MOTIONS)[number];

export class LegacyHero extends Container {
  private actor: Spine;
  private appearance: LegacyAppearance = { outfit: 'quanzhen', hair: 'Hair1', weapon: 'Sword' };
  private injuries: LegacyInjuryPose;
  private body = createBody();
  private moving = false;
  private elapsed = 0;

  constructor(assets: { skeleton: string; atlas: string }) {
    super();
    this.actor = Spine.from({ ...assets, autoUpdate: false });
    this.injuries = new LegacyInjuryPose(this.actor.skeleton);
    this.actor.beforeUpdateWorldTransforms = () => this.injuries.setPose(this.moving, this.elapsed);
    this.actor.state.data.defaultMix = 0.12;
    this.addChild(this.actor);
    this.playMotion('Idle');
  }

  setAppearance(appearance: LegacyAppearance): void {
    this.appearance = { ...appearance };
    const prefix = { farmer: '0', quanzhen: '1', blue: '3' }[appearance.outfit];
    const skin = this.actor.skeleton.data.defaultSkin!;
    for (const slot of this.actor.skeleton.slots) {
      const entry = skin
        .getAttachments()
        .find((item) => item.slotIndex === slot.data.index && item.placeholder.startsWith(prefix));
      if (entry) {
        this.actor.skeleton.setAttachment(slot.data.name, entry.placeholder);
      }
    }
    this.actor.skeleton.setAttachment('Hair', appearance.hair);
    this.actor.skeleton.setAttachment(
      'Weapon',
      appearance.weapon === 'none' ||
        (this.body.leftArm === 0 && this.body.rightArm === 0) ||
        mobility(this.body, this.moving) === 'crawling'
        ? null
        : appearance.weapon,
    );
  }

  playMotion(motion: LegacyMotion, loop = true): void {
    this.moving = motion === 'Run';
    this.actor.state.clearTracks();
    this.actor.skeleton.setupPose();
    this.injuries.setBody(this.body);
    this.actor.state.setAnimation(0, motion, loop);
    if (!loop) {
      this.actor.state.addAnimation(0, 'Idle', true, 0);
    }
    this.actor.state.setAnimation(1, 'Blink', true);
    this.update(0);
    this.setAppearance(this.appearance);
  }

  update(seconds: number): void {
    this.elapsed += seconds;
    // 未設 key 的骨頭也會被傷勢覆蓋，每幀先還原，避免偏移持續累加。
    this.actor.skeleton.setupPoseBones();
    this.actor.update(seconds);
  }

  setBody(body: BodyState): void {
    this.body = { ...body };
    this.injuries.setBody(body);
    this.setAppearance(this.appearance);
    this.update(0);
  }
}
