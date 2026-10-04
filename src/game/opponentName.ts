/** Stable identifiers keep identical opponents distinguishable across combat UI. */
export function opponentName(enemies: readonly { name: string }[], index: number): string {
  const name = enemies[index].name;
  return enemies.filter((enemy) => enemy.name === name).length > 1 ? `${name} ${index + 1}` : name;
}
