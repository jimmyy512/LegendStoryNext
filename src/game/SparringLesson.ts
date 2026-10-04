import type { Battle, BattleEvent } from './battle';

export type SparringCue =
  { kind: 'defend' } | { kind: 'opening'; blocked: number; damage: number; missed: boolean };

/** Only the first sparring match pauses for two short, contextual lessons. */
export class SparringLesson {
  private phase: 'heavy' | 'opening' | 'done' = 'heavy';

  skip(): void {
    this.phase = 'done';
  }

  next(battle: Battle, events: BattleEvent[]): SparringCue | null {
    if (battle.encounterId !== 'trial' || battle.result || this.phase === 'done') {
      return null;
    }
    if (
      this.phase === 'heavy' &&
      battle.preparingHeavy(0) &&
      battle.inRange(0, battle.enemyRange(0)) &&
      battle.stamina >= 20 &&
      battle.guardCooldown === 0
    ) {
      this.phase = 'opening';
      return { kind: 'defend' };
    }
    if (this.phase === 'opening' && battle.enemies[0].opening) {
      const hit = events.find(
        (event) => event.source === 0 && event.kind === 'damage' && event.heavy,
      );
      this.phase = 'done';
      return {
        kind: 'opening',
        blocked: hit?.blocked ?? 0,
        damage: hit?.amount ?? 0,
        missed: !hit,
      };
    }
    return null;
  }
}
