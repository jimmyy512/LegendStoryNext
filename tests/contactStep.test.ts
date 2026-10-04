import { describe, expect, it } from 'vitest';
import { ContactStep } from '../src/render/ContactStep';

describe('visual attack approach', () => {
  it('approaches without overshoot, holds during the reply, then returns to formation', () => {
    const step = new ContactStep();
    step.start(120, -60, 0.5);
    for (let i = 0; i < 50; i++) {
      step.update(0.01);
      expect(step.x).toBeGreaterThanOrEqual(0);
      expect(step.x).toBeLessThanOrEqual(120);
      expect(step.y).toBeGreaterThanOrEqual(-60);
    }
    step.strike();
    step.update(1, true);
    expect([step.x, step.y]).toEqual([120, -60]);
    step.update(0.5);
    expect(Math.hypot(step.x, step.y)).toBe(0);
    step.strike();
    expect(Math.hypot(step.x, step.y)).toBe(0);
  });

  it('cancelling halfway withdraws from the current position without completing the lunge', () => {
    const step = new ContactStep();
    step.start(-200, 60, 0.7);
    step.update(0.2);
    const stoppedAt = step.x;
    step.cancel();
    step.update(0.01);
    expect(step.x).toBe(stoppedAt);
    step.update(0.5);
    expect(Math.hypot(step.x, step.y)).toBe(0);
  });

  it('resumes an interrupted withdrawal from the held position, not the strike position', () => {
    const step = new ContactStep();
    step.start(120, -60, 0.5);
    step.strike();
    step.update(0.24);
    const held = [step.x, step.y];
    expect(step.x).toBeCloseTo(60);
    step.update(0.5, true);
    step.update(0.5, true);
    expect([step.x, step.y]).toEqual(held);
    step.update(0);
    expect([step.x, step.y]).toEqual(held);
    step.update(0.01);
    expect(step.x).toBeLessThan(held[0]!);
    expect(step.y).toBeGreaterThan(held[1]!);
    step.update(0.5);
    expect([step.x, step.y]).toEqual([0, -0]);
  });

  it('starts the next approach at the current position during a withdrawal', () => {
    const step = new ContactStep();
    step.start(120, -60, 0.5);
    step.strike();
    step.update(0.24);
    const origin = [step.x, step.y];
    step.start(-90, 45, 0.5);
    step.update(0);
    expect([step.x, step.y]).toEqual(origin);
    step.update(0.01);
    expect(Math.hypot(step.x - origin[0]!, step.y - origin[1]!)).toBeLessThan(1);
    step.update(0.5);
    expect([step.x, step.y]).toEqual([-90, 45]);
  });
});
