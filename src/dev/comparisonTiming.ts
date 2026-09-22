export const PALM_DURATION = 2.8;

export function pixelPalmFrame(time: number): number {
  const thresholds = [0, 0.22, 0.55, 0.82, 0.99, 1.25, 1.8, 2.22];
  return Math.max(0, thresholds.filter((start) => time >= start).length - 1);
}

export function palmPhase(time: number): string {
  return time < 0.22 ? '起式' : time < 0.82 ? '蓄勁' : time < 1.8 ? '降龍出掌' : '收勢';
}

export function dragonProgress(time: number): number {
  return Math.max(0, Math.min(1, (time - 0.82) / 1.15));
}
