import type { Point } from '../game/types';

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
