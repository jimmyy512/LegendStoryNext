import type { Battle } from './battle';
import { opponentName } from './opponentName';

/** All living opponents matter, including those outside the selected target card. */
export function battleThreat(battle: Battle): { count: number; warning: string | null } {
  const threatening = battle.enemies
    .map((enemy, index) => ({ enemy, index }))
    .filter(
      ({ enemy, index }) =>
        enemy.hp > 0 && battle.inRange(index, enemy.strikeRange ?? battle.enemyRange(index)),
    );
  const preparing = threatening
    .filter(({ enemy }) => !!enemy.strikeRange)
    .sort(
      (a, b) =>
        Number(battle.preparingHeavy(b.index)) - Number(battle.preparingHeavy(a.index)) ||
        a.enemy.windup - b.enemy.windup,
    )[0];
  return {
    count: threatening.length,
    warning: preparing
      ? `${opponentName(battle.enemies, preparing.index)}正在${battle.preparingHeavy(preparing.index) ? '重擊蓄力' : '出手'}！拉開或防禦`
      : null,
  };
}
