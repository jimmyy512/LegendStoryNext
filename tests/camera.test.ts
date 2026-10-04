import { describe, expect, it } from 'vitest';
import { battleCameraY, cameraFrame } from '../src/render/camera';

const scene = { width: 1152, height: 720 };
describe('滿版取景', () => {
  it.each([
    [158, 332, 358 / 674],
    [185, 524, 1.4],
    [106, 100, 0.3],
  ])('戰鬥縮放後美術覆蓋可玩區域：top=%i height=%i', (top, height, scale) => {
    const art = { top: -130, bottom: 630 };
    const y = battleCameraY(top, height, 385, scale, art);
    expect(y + art.bottom * scale).toBeGreaterThanOrEqual(top + height - 0.001);
    expect(y + art.top * scale).toBeLessThanOrEqual(top + 0.001);
  });
  it.each([
    [844, 390],
    [568, 260],
    [932, 430],
    [390, 844],
    [1440, 900],
  ])('%i × %i 不露出場景外空白且保留地圖四角可抵達', (width, height) => {
    for (const focus of [
      { x: 0, y: 0 },
      { x: 1152, y: 720 },
      { x: 576, y: 360 },
    ]) {
      const frame = cameraFrame({ viewport: { width, height }, scene, focus });
      expect(frame.x).toBeLessThanOrEqual(0);
      expect(frame.y).toBeLessThanOrEqual(0);
      expect(frame.x + scene.width * frame.scale).toBeGreaterThanOrEqual(width - 0.001);
      expect(frame.y + scene.height * frame.scale).toBeGreaterThanOrEqual(height - 0.001);
      const heroX = focus.x * frame.scale + frame.x;
      const heroY = focus.y * frame.scale + frame.y;
      expect(heroX).toBeGreaterThanOrEqual(-0.001);
      expect(heroX).toBeLessThanOrEqual(width + 0.001);
      expect(heroY).toBeGreaterThanOrEqual(-0.001);
      expect(heroY).toBeLessThanOrEqual(height + 0.001);
    }
  });
});
