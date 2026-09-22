import {
  AnimationState,
  AnimationStateData,
  AtlasAttachmentLoader,
  Skeleton,
  SkeletonJson,
  Skin,
  TextureAtlas,
} from '@esotericsoftware/spine-core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const directory = 'public/assets/characters/hero/';
const atlas = new TextureAtlas(readFileSync(`${directory}hero.atlas`, 'utf8'));
const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(
  JSON.parse(readFileSync(`${directory}hero.json`, 'utf8')),
);

function dress(skeleton: Skeleton, names: string[]): void {
  const skin = new Skin('test');
  for (const name of ['body', ...names]) {
    const part = data.findSkin(name);
    expect(part, name).not.toBeNull();
    skin.addSkin(part!);
  }
  skeleton.setSkin(skin);
  skeleton.setupPoseSlots();
}

describe('Spine 匯出素材', () => {
  it('使用 4.3 格式，所有圖塊引用能由官方 runtime 解析', () => {
    expect(data.version).toMatch(/^4\.3\./);
    expect(data.bones).toHaveLength(19);
    expect(data.animations.map((animation) => animation.name)).toEqual(
      expect.arrayContaining(['idle', 'walk', 'attackR', 'attackL', 'hurt', 'injuredR', 'seated']),
    );
  });

  it('所有換裝組合保留身體，武器只存在於指定手部', () => {
    for (const outfit of ['ivory', 'jade']) {
      for (const hair of ['topknot', 'tied']) {
        for (const weapon of ['plain', 'jade']) {
          for (const hand of ['R', 'L']) {
            const skeleton = new Skeleton(data);
            dress(skeleton, [`outfit/${outfit}`, `hair/${hair}`, `weapon/${weapon}/${hand}`]);
            for (const slot of skeleton.slots) {
              const hidden = slot.data.name === `weapon${hand === 'R' ? 'L' : 'R'}`;
              expect(Boolean(slot.pose.attachment), slot.data.name).toBe(!hidden);
            }
          }
        }
      }
    }
  });

  it('換手和卸下武器不留下舊插槽內容', () => {
    const skeleton = new Skeleton(data);
    const clothes = ['outfit/ivory', 'hair/topknot'];
    dress(skeleton, [...clothes, 'weapon/plain/R']);
    dress(skeleton, [...clothes, 'weapon/jade/L']);
    expect(skeleton.findSlot('weaponR')!.pose.attachment).toBeNull();
    expect(skeleton.findSlot('weaponL')!.pose.attachment).not.toBeNull();
    dress(skeleton, clothes);
    expect(skeleton.findSlot('weaponL')!.pose.attachment).toBeNull();
  });

  it('傷手姿態覆蓋右手，左手攻擊時間軸仍能播放', () => {
    const skeleton = new Skeleton(data);
    const state = new AnimationState(new AnimationStateData(data));
    state.setAnimation(0, 'attackL', false);
    state.setAnimation(1, 'injuredR', true);
    state.update(0.18);
    state.apply(skeleton);
    expect(skeleton.findBone('upperArmR')!.pose.rotation).toBeCloseTo(4);
    expect(skeleton.findBone('upperArmL')!.pose.rotation).toBeCloseTo(65);
  });
});
