export interface WorldLabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Keep nearby nameplates on separate rows without moving their world objects. */
export function placeWorldLabel(
  preferred: WorldLabelBox,
  placed: readonly WorldLabelBox[],
): WorldLabelBox {
  const result = { ...preferred };
  const gap = 5;
  while (true) {
    const collision = placed.find(
      (other) =>
        result.x < other.x + other.width + gap &&
        result.x + result.width + gap > other.x &&
        result.y < other.y + other.height + gap &&
        result.y + result.height + gap > other.y,
    );
    if (!collision) {
      return result;
    }
    result.y = collision.y + collision.height + gap;
  }
}
