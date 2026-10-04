import type { DialogueShot } from '../game/chapterOneDialogue';
import type { Point } from '../game/types';

/** 依可見舞臺取景，留出實際對話框；縮放上限讓手機仍容得下兩人。 */
export function dialogueCameraFrame(options: {
  viewport: { width: number; height: number };
  scene: { width: number; height: number };
  player: Point;
  subject: Point;
  shot: DialogueShot;
  stageHeight: number;
}) {
  const { viewport, scene, player, subject, shot } = options;
  const stageHeight = Math.max(100, Math.min(viewport.height - 50, options.stageHeight));
  const pair = shot === 'two-shot' || shot === 'wide';
  const focus = pair
    ? { x: (player.x + subject.x) / 2, y: (player.y + subject.y) / 2 - 32 }
    : shot === 'player'
      ? { x: player.x, y: player.y - 32 }
      : { x: subject.x, y: subject.y - (shot === 'detail' ? 20 : 32) };
  const base = Math.max(viewport.width / scene.width, viewport.height / scene.height);
  const desired = base * (shot === 'wide' ? 1.45 : pair ? 2.15 : shot === 'detail' ? 2.6 : 2.4);
  const span = pair ? Math.abs(player.x - subject.x) + 110 : 120;
  const scale = Math.max(
    base,
    Math.min(desired, (viewport.width - 24) / span, (stageHeight - 24) / 110),
  );
  const offset = (desired: number, screen: number, extent: number) =>
    Math.min(0, Math.max(screen - extent * scale, desired));
  return {
    scale,
    x: offset(viewport.width / 2 - focus.x * scale, viewport.width, scene.width),
    y: offset(stageHeight / 2 - focus.y * scale, viewport.height, scene.height),
  };
}
