import {
  AnimationState,
  AnimationStateData,
  AtlasAttachmentLoader,
  Physics,
  Skeleton,
  SkeletonJson,
  TextureAtlas,
} from '@esotericsoftware/spine-core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createBody } from '../src/game/body';
import { heroAppearance } from '../src/render/heroAppearance';
import { LegacyInjuryPose } from '../src/render/LegacyInjuryPose';

const directory = 'public/assets/characters/legacyHero/';
const data = new SkeletonJson(
  new AtlasAttachmentLoader(new TextureAtlas(readFileSync(`${directory}legacy.atlas`, 'utf8'))),
).readSkeletonData(JSON.parse(readFileSync(`${directory}legacy.json`, 'utf8')));

describe('主角顯示規則', () => {
  it('外觀只根據已裝備物品，未裝備不持劍', () => {
    expect(heroAppearance({ weapon: null, armor: null, hair: 'Hair1' })).toEqual({
      outfit: 'farmer',
      hair: 'Hair1',
      weapon: 'none',
    });
    expect(heroAppearance({ weapon: 'sword', armor: 'robe', hair: 'Hair2' })).toMatchObject({
      outfit: 'quanzhen',
      weapon: 'Sword',
    });
    expect(heroAppearance({ weapon: 'wraps', armor: 'armor', hair: 'Hair4' })).toMatchObject({
      outfit: 'blue',
      weapon: 'none',
    });
  });

  it('右手失能時換到左手，復原後回到右手，不修改共用骨架', () => {
    const skeleton = new Skeleton(data);
    const pose = new LegacyInjuryPose(skeleton);
    const body = createBody();
    body.rightArm = 0;
    pose.setBody(body);
    expect(skeleton.findBone('Weapon')!.parent!.data.name).toBe('LeftFist');
    expect(new Skeleton(data).findBone('Weapon')!.parent!.data.name).toBe('RightFist');
    pose.setBody(createBody());
    expect(skeleton.findBone('Weapon')!.parent!.data.name).toBe('RightFist');
    expect(skeleton.findBone('LeftFist')!.children).not.toContain(skeleton.findBone('Weapon'));
  });

  it('各種傷勢與移動逐格運算都有有限座標，姿態不累加漂移', () => {
    for (const injury of ['rightArm', 'arms', 'rightLeg', 'legs', 'all']) {
      for (const moving of [false, true]) {
        const skeleton = new Skeleton(data);
        const pose = new LegacyInjuryPose(skeleton);
        const state = new AnimationState(new AnimationStateData(data));
        const body = createBody();
        if (['rightArm', 'arms', 'all'].includes(injury)) {
          body.rightArm = 0;
        }
        if (['arms', 'all'].includes(injury)) {
          body.leftArm = 0;
        }
        if (['rightLeg', 'legs', 'all'].includes(injury)) {
          body.rightLeg = 0;
        }
        if (['legs', 'all'].includes(injury)) {
          body.leftLeg = 0;
        }
        pose.setBody(body);
        state.setAnimation(0, moving ? 'Run' : 'Idle', true);
        for (let frame = 0; frame < 180; frame++) {
          skeleton.setupPoseBones();
          state.update(1 / 24);
          state.apply(skeleton);
          pose.setPose(moving, frame / 24);
          skeleton.updateWorldTransform(Physics.none);
          for (const bone of skeleton.bones) {
            expect(Number.isFinite(bone.appliedPose.worldX)).toBe(true);
            expect(Number.isFinite(bone.appliedPose.worldY)).toBe(true);
          }
          expect(Math.abs(skeleton.findBone('Main')!.pose.y)).toBeLessThan(200);
        }
      }
    }
  });
});
