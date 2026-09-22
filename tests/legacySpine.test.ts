import {
  AnimationState,
  AnimationStateData,
  AtlasAttachmentLoader,
  Skeleton,
  SkeletonJson,
  TextureAtlas,
} from '@esotericsoftware/spine-core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  convertBoneTimeline,
  LEGACY_ANIMATIONS,
  migrateLegacyHero,
  type ConvertedSkeleton,
} from '../tools/legacySpine';

const source = 'art/characters/legacyHero/converted/';
const main = JSON.parse(
  readFileSync(`${source}character_MainCharacter.json`, 'utf8'),
) as ConvertedSkeleton;
const face = JSON.parse(
  readFileSync(`${source}character_普通扎眼.json`, 'utf8'),
) as ConvertedSkeleton;
const output = 'public/assets/characters/legacyHero/';
const data = new SkeletonJson(
  new AtlasAttachmentLoader(new TextureAtlas(readFileSync(`${output}legacy.atlas`, 'utf8'))),
).readSkeletonData(JSON.parse(readFileSync(`${output}legacy.json`, 'utf8')));

describe('原版主角格式移植', () => {
  it('旋轉曲線轉為絕對時間與值，不更動來源', () => {
    const frames = [
      { time: 2, angle: 10, curve: [0.25, 0, 0.75, 1] },
      { time: 4, angle: 30 },
    ];
    const converted = convertBoneTimeline('rotate', frames);
    expect(converted[0]).toEqual({ time: 2, value: 10, curve: [2.5, 10, 3.5, 30] });
    expect(frames[0].angle).toBe(10);
  });

  it('雙通道各自轉換控制點，保留 scale 的預設值 1', () => {
    const converted = convertBoneTimeline('scale', [
      { curve: [0.25, 0, 0.75, 1] },
      { time: 2, x: 3, y: 0 },
    ]);
    expect(converted[0].curve).toEqual([0.5, 1, 1.5, 3, 0.5, 1, 1.5, 0]);
  });

  it('保留 stepped，拒絕未知時間軸與無效曲線', () => {
    expect(
      convertBoneTimeline('rotate', [
        { angle: 3, curve: 'stepped' },
        { time: 1, angle: 5 },
      ])[0].curve,
    ).toBe('stepped');
    expect(() => convertBoneTimeline('unknown', [])).toThrow();
    expect(() => convertBoneTimeline('rotate', [{ curve: [0, 1] }])).toThrow();
  });

  it('不覆寫原 24 段動畫，第一批只輸出五段主角動作加眨眼', () => {
    const before = JSON.stringify(main);
    const migrated = migrateLegacyHero(main, face);
    expect(JSON.stringify(main)).toBe(before);
    expect(Object.keys(main.animations)).toHaveLength(24);
    expect(Object.keys(migrated.animations)).toEqual([...LEGACY_ANIMATIONS, 'Blink']);
    expect(migrated.bones).toHaveLength(46);
    expect(migrated.slots).toHaveLength(19);
    expect(migrated.bones.find((bone) => bone.name === 'face/root')).toMatchObject({
      parent: 'Facial',
      rotation: -90,
    });
  });

  it('匯出維持原片段時長與全部可見角色部件', () => {
    const frames: Record<string, number> = {
      Idle: 80,
      Run: 35,
      NormalAttack1: 36,
      NormalAttack2: 38,
      NormalAttack3: 40,
    };
    expect(data.version).toMatch(/^4\.3\./);
    const skeleton = new Skeleton(data);
    for (const [name, duration] of Object.entries(frames)) {
      expect(data.findAnimation(name)!.duration).toBeCloseTo(duration / 24, 3);
    }
    for (const slot of skeleton.slots) {
      expect(slot.pose.attachment, slot.data.name).not.toBeNull();
    }
  });

  it('每段動作逐格運算沒有 NaN，眨眼能獨立播放', () => {
    for (const name of LEGACY_ANIMATIONS) {
      const skeleton = new Skeleton(data);
      const state = new AnimationState(new AnimationStateData(data));
      state.setAnimation(0, name, true);
      state.setAnimation(1, 'Blink', true);
      for (let frame = 0; frame < 160; frame++) {
        state.update(1 / 24);
        state.apply(skeleton);
        for (const bone of skeleton.bones) {
          for (const value of [
            bone.pose.x,
            bone.pose.y,
            bone.pose.rotation,
            bone.pose.scaleX,
            bone.pose.scaleY,
            bone.pose.shearX,
            bone.pose.shearY,
          ]) {
            expect(Number.isFinite(value), `${name}/${bone.data.name}`).toBe(true);
          }
        }
      }
      expect(skeleton.findSlot('face/眼睛')!.pose.attachment).not.toBeNull();
    }
  });
});
