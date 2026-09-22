import { COLS, ROWS } from '../data/maps';
import type { MapDefinition, Point } from './types';

export function isWalkable(map: MapDefinition, point: Point): boolean {
  return (
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x > 0 &&
    point.y > 0 &&
    point.x < COLS - 1 &&
    point.y < ROWS - 1 &&
    !map.blocks.some(
      (b) => point.x >= b.x && point.x < b.x + b.w && point.y >= b.y && point.y < b.y + b.h,
    )
  );
}

export function findPath(map: MapDefinition, from: Point, to: Point): Point[] {
  if (!isWalkable(map, from) || !isWalkable(map, to)) {
    return [];
  }
  const key = (p: Point) => `${p.x},${p.y}`;
  const queue = [from];
  const parents = new Map<string, Point | null>([[key(from), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current.x === to.x && current.y === to.y) {
      const path: Point[] = [];
      let step: Point | null = current;
      while (step && key(step) !== key(from)) {
        path.unshift(step);
        step = parents.get(key(step)) ?? null;
      }
      return path;
    }
    for (const delta of [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ]) {
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      if (isWalkable(map, next) && !parents.has(key(next))) {
        parents.set(key(next), current);
        queue.push(next);
      }
    }
  }
  return [];
}
