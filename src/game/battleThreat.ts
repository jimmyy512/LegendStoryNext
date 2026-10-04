import { BATTLE_LEFT, type Battle } from './battle';
import { movementRate } from './body';
import { opponentName } from './opponentName';

/** All living opponents matter, including those outside the selected target card. */
export function battleThreat(battle: Battle): {
  count: number;
  warning: string | null;
  canRetreat: boolean;
} {
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
  const committed = threatening.filter(({ enemy }) => !!enemy.strikeRange);
  const time = committed.length ? Math.min(...committed.map(({ enemy }) => enemy.windup)) : 0;
  const distanceNeeded = Math.max(
    0,
    ...committed.map(({ enemy, index }) => enemy.strikeRange!.max - battle.distance(index) + 0.05),
  );
  const speed = (1.8 + battle.stats.speed * 0.025) * movementRate(battle.player.body);
  const retreat = Math.min(
    battle.playerPosition - BATTLE_LEFT,
    speed * Math.max(0, time - battle.recovery),
  );
  const canRetreat =
    !!preparing &&
    !battle.strike &&
    battle.stamina >= Math.max(1, time * 24) &&
    retreat > distanceNeeded;
  const canDefend = battle.stamina >= 20 && battle.guardCooldown === 0;
  return {
    count: threatening.length,
    canRetreat,
    warning: preparing
      ? `${opponentName(battle.enemies, preparing.index)}正在${battle.preparingHeavy(preparing.index) ? '重擊蓄力' : '出手'}！${canRetreat ? (canDefend ? '拉開或防禦' : '立即拉開距離') : canDefend ? '退不出射程，立即防禦' : '退不出射程，腳力不足以防禦'}`
      : null,
  };
}
