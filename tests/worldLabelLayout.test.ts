import { describe, expect, it } from 'vitest';
import { placeWorldLabel } from '../src/render/worldLabelLayout';

describe('exploration nameplates', () => {
  it('keeps neighboring bandit and wine labels separate without shifting their horizontal anchors', () => {
    const bandit = { x: 750, y: 380, width: 74, height: 23 };
    const wine = { x: 791, y: 380, width: 88, height: 23 };
    expect(placeWorldLabel(wine, [bandit])).toEqual({ ...wine, y: 408 });
    expect(wine.y).toBe(380);
  });
  it('finds the next free row across a cluster and leaves distant labels unchanged', () => {
    const box = { x: 100, y: 200, width: 90, height: 23 };
    const cluster = [box, { ...box, y: 228 }, { ...box, y: 256 }];
    expect(placeWorldLabel(box, cluster).y).toBe(284);
    expect(placeWorldLabel({ ...box, x: 300 }, cluster)).toEqual({ ...box, x: 300 });
  });
});
