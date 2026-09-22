import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  dragonProgress,
  PALM_DURATION,
  palmPhase,
  pixelPalmFrame,
} from '../src/dev/comparisonTiming';

describe('女俠風格比較時間軸', () => {
  it('八個像素姿勢依時間切換，拖到兩端不超出圖集', () => {
    expect([0, 0.22, 0.55, 0.82, 0.99, 1.25, 1.8, 2.22].map(pixelPalmFrame)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(pixelPalmFrame(-1)).toBe(0);
    expect(pixelPalmFrame(PALM_DURATION)).toBe(7);
  });

  it('先蓄力才出龍，收勢後特效進度固定在終點', () => {
    expect(palmPhase(0.5)).toBe('蓄勁');
    expect(palmPhase(1.1)).toBe('降龍出掌');
    expect(palmPhase(2.2)).toBe('收勢');
    expect(dragonProgress(0.8)).toBe(0);
    expect(dragonProgress(1.395)).toBeCloseTo(0.5);
    expect(dragonProgress(2.8)).toBe(1);
  });

  it('正式 Spine 匯出保留部件縮放與完整出掌片段', () => {
    const data = JSON.parse(readFileSync('public/assets/styleComparison/heroine.json', 'utf8'));
    const head = data.skins[0].attachments.head.head;
    expect(head.width * head.scaleX).toBeCloseTo(112, 1);
    expect(data.bones).toHaveLength(11);
    expect(data.slots).toHaveLength(9);
    expect(data.animations.dragonPalm.bones.hip.translate.at(-1).time).toBe(PALM_DURATION);
    expect(data.animations.dragonPalm.bones.upperFront.rotate).toHaveLength(8);
  });
});
