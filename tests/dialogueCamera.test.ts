import { describe, expect, it } from 'vitest';
import { dialogueCameraFrame } from '../src/render/dialogueCamera';

describe('對話可見舞臺', () => {
  it.each([
    [1680, 949, 550],
    [390, 844, 532],
    [844, 390, 150],
  ])('%i × %i 的雙人鏡頭保留人物與完整場景', (width, height, stageHeight) => {
    const scene = { width: 1152, height: 720 };
    const player = { x: 480, y: 360 };
    const subject = { x: 550, y: 360 };
    const frame = dialogueCameraFrame({
      viewport: { width, height },
      scene,
      player,
      subject,
      shot: 'two-shot',
      stageHeight,
    });
    expect(frame.x).toBeLessThanOrEqual(0);
    expect(frame.y).toBeLessThanOrEqual(0);
    expect(frame.x + scene.width * frame.scale).toBeGreaterThanOrEqual(width - 0.001);
    expect(frame.y + scene.height * frame.scale).toBeGreaterThanOrEqual(height - 0.001);
    for (const actor of [player, subject]) {
      expect(actor.x * frame.scale + frame.x).toBeGreaterThan(0);
      expect(actor.x * frame.scale + frame.x).toBeLessThan(width);
      expect((actor.y - 62) * frame.scale + frame.y).toBeGreaterThan(0);
      expect(actor.y * frame.scale + frame.y).toBeLessThan(stageHeight);
    }
  });
});
