import type { Point } from '../game/types';

/** Keep the playable strip covered when a battle zoom changes its art bounds. */
export function battleCameraY(
  top: number,
  height: number,
  focusY: number,
  scale: number,
  art: { top: number; bottom: number },
): number {
  const desired = top + height / 2 - focusY * scale;
  const minimum = top + height - art.bottom * scale;
  const maximum = top - art.top * scale;
  return minimum <= maximum ? Math.max(minimum, Math.min(maximum, desired)) : minimum;
}

export function cameraFrame(options: {
  viewport: { width: number; height: number };
  scene: { width: number; height: number };
  focus: Point;
}): { scale: number; x: number; y: number } {
  const { viewport, scene, focus } = options;
  const scale = Math.max(viewport.width / scene.width, viewport.height / scene.height);
  const offset = (screen: number, extent: number, center: number) =>
    Math.min(0, Math.max(screen - extent * scale, screen / 2 - center * scale));
  return {
    scale,
    x: offset(viewport.width, scene.width, focus.x),
    y: offset(viewport.height, scene.height, focus.y),
  };
}
