import { COLS, ROWS } from '../data/maps';
import type { MapDefinition, Point } from './types';

export function isWalkable(map: MapDefinition, point: Point): boolean {
  const inBounds =
    Number.isInteger(point.x) &&
    Number.isInteger(point.y) &&
    point.x >= (map.walkableRows ? 0 : 1) &&
    point.y >= (map.walkableRows ? 0 : 1) &&
    point.x < (map.walkableRows ? COLS : COLS - 1) &&
    point.y < (map.walkableRows ? ROWS : ROWS - 1);
  if (!inBounds) {
    return false;
  }
  if (map.walkableRows) {
    return (map.walkableRows[point.y] ?? []).some(
      ([left, right]) => point.x >= left && point.x <= right,
    );
  }
  return !map.blocks.some(
    (b) => point.x >= b.x && point.x < b.x + b.w && point.y >= b.y && point.y < b.y + b.h,
  );
}

/** Old saves may point inside newly painted water or cliffs. Move to the closest safe tile. */
export function nearestWalkable(map: MapDefinition, point: Point): Point {
  if (isWalkable(map, point)) {
    return point;
  }
  let nearest: Point | null = null;
  let distance = Infinity;
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      const candidate = { x, y };
      if (!isWalkable(map, candidate)) {
        continue;
      }
      const score = Math.abs(x - point.x) + Math.abs(y - point.y);
      if (score < distance) {
        nearest = candidate;
        distance = score;
      }
    }
  }
  if (!nearest) {
    throw new Error(`Map has no walkable tiles: ${map.id}`);
  }
  return nearest;
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
