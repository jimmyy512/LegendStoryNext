import { ENCOUNTERS, ENEMIES, ITEMS, SKILLS } from '../data/content';
import { CombatClock } from './CombatClock';
import {
  createBody,
  damagePart,
  limbPower,
  PART_NAMES,
  workingHands,
  workingLegs,
  type BodyPart,
  type BodyState,
  type LimbRequirement,
} from './body';
import { getStats, useMedicine } from './state';
import type { GameState, ItemId, Stats } from './types';

export type BattleAction =
  | { type: 'attack'; target: number }
  | { type: 'skill'; skill: string; target: number }
  | { type: 'item'; item: ItemId }
  | { type: 'defend' }
  | { type: 'escape' };

export interface BattleEnemy {
  id: string;
  name: string;
  hp: number;
  stats: Stats;
  body: BodyState;
  progress: number;
  actions: number;
  broken: number;
  color: number;
}
export interface BattleEvent {
  text: string;
  source?: number | 'player';
  target?: number | 'player';
  part?: BodyPart;
  amount?: number;
  kind?: 'damage' | 'heal' | 'guard' | 'injury';
}
export type BattleResult = 'victory' | 'defeat' | 'escaped' | null;

export class Battle {
  readonly player: GameState;
  readonly enemies: BattleEnemy[];
  readonly encounter;
  readonly stats: Stats;
  readonly clock = new CombatClock();
  result: BattleResult = null;
  paused = true;
  autoAttack = true;
  target = 0;
  targetPart: BodyPart = 'chest';
  playerProgress = 0;
  defending = false;
  counter = false;
  events: BattleEvent[] = [];
  private pending: BattleAction | null = null;

  constructor(
    state: GameState,
    readonly encounterId: string,
    private readonly random: () => number = Math.random,
  ) {
    const encounter = ENCOUNTERS[encounterId];
    if (!encounter) {
      throw new Error('找不到戰鬥資料');
    }
    this.encounter = encounter;
    this.player = structuredClone(state);
    this.stats = getStats(this.player);
    this.enemies = encounter.enemies.map((id) => ({
      id,
      name: ENEMIES[id].name,
      hp: ENEMIES[id].maxHp,
      stats: ENEMIES[id],
      body: createBody(),
      progress: 0,
      color: ENEMIES[id].color,
      actions: 0,
      broken: 0,
    }));
    this.events.push({
      text: '戰術暫停中。選擇敵人與部位，再開始交鋒。蓄勢完成會自動普攻，招式可預約下一次出手。',
    });
  }

  get queuedAction(): BattleAction | null {
    return this.pending ? { ...this.pending } : null;
  }

  get reward(): { xp: number; gold: number } {
    return this.enemies.reduce(
      (sum, enemy) => ({
        xp: sum.xp + ENEMIES[enemy.id].xp,
        gold: sum.gold + ENEMIES[enemy.id].gold,
      }),
      { xp: 0, gold: 0 },
    );
  }

  intent(index: number): string {
    const enemy = this.enemies[index];
    if (workingHands(enemy.body) === 0) {
      return '雙手失能 · 改以腿法';
    }
    return this.isHeavy(enemy) ? '蓄勢重擊 · 雙手' : '普通攻擊 · 單手';
  }

  skillPower(id: string): number {
    const skill = SKILLS[this.player.route].find((entry) => entry.id === id);
    return skill ? limbPower(this.player.body, skill.limbs) : 0;
  }

  togglePause(): void {
    if (!this.result) {
      this.paused = !this.paused;
    }
  }

  /** 指令只預約，不提前扣費。到出手時再次檢查傷勢與內力。 */
  act(action: BattleAction): string | null {
    if (this.result) {
      return '戰鬥已結束。';
    }
    const error = this.validate(action);
    if (error) {
      return error;
    }
    this.pending = { ...action };
    if ('target' in action) {
      this.target = action.target;
    }
    this.paused = false;
    return null;
  }

  cancelAction(): void {
    this.pending = null;
  }

  update(seconds: number): BattleEvent[] {
    if (this.paused || this.result) {
      return [];
    }
    const emitted: BattleEvent[] = [];
    this.clock.advance(seconds, (dt) => {
      this.playerProgress = Math.min(1, this.playerProgress + dt / this.interval(this.stats.speed));
      for (const enemy of this.enemies) {
        if (enemy.hp > 0) {
          enemy.progress = Math.min(1, enemy.progress + dt / this.interval(enemy.stats.speed));
        }
      }
      if (this.playerProgress >= 1 && (this.pending || this.autoAttack)) {
        const action = this.pending ?? { type: 'attack' as const, target: this.aliveTarget() };
        this.pending = null;
        this.defending = false;
        this.counter = false;
        const error = this.validate(action);
        if (error) {
          emitted.push({ text: error });
        } else {
          this.resolvePlayer(action, emitted);
        }
        this.playerProgress = 0;
        this.checkResult(emitted);
      }
      for (const [index, enemy] of this.enemies.entries()) {
        if (this.result) {
          break;
        }
        if (enemy.hp <= 0 || enemy.progress < 1) {
          continue;
        }
        this.resolveEnemy(index, emitted);
        enemy.progress = 0;
        enemy.actions++;
        enemy.broken = Math.max(0, enemy.broken - 1);
        this.checkResult(emitted);
      }
      return !this.result;
    });
    this.events.push(...emitted);
    this.events = this.events.slice(-8);
    return emitted;
  }

  private interval(speed: number): number {
    return Math.max(1.2, 2.8 - speed * 0.06);
  }

  private aliveTarget(): number {
    if (this.enemies[this.target]?.hp > 0) {
      return this.target;
    }
    this.target = Math.max(
      0,
      this.enemies.findIndex((enemy) => enemy.hp > 0),
    );
    return this.target;
  }

  private validate(action: BattleAction): string | null {
    if (
      'target' in action &&
      (!this.enemies[action.target] || this.enemies[action.target].hp <= 0)
    ) {
      return '目標已敗退，請重新選擇。';
    }
    if (action.type === 'skill') {
      const skill = SKILLS[this.player.route].find((entry) => entry.id === action.skill);
      if (!skill) {
        return '尚未習得這門武學。';
      }
      if (this.player.mp < skill.cost) {
        return '內力不足。';
      }
      if (this.skillPower(skill.id) === 0) {
        return '所需肢體已失能，無法施展此招。';
      }
    }
    if (action.type === 'item') {
      const item = ITEMS[action.item];
      if (!item || item.kind !== 'medicine' || this.player.inventory[action.item] <= 0) {
        return '藥品不足。';
      }
      if (
        (!item.hp || this.player.hp >= this.stats.maxHp) &&
        (!item.mp || this.player.mp >= this.stats.maxMp)
      ) {
        return '目前不需要這項藥品。';
      }
    }
    if (
      action.type === 'escape' &&
      (!this.encounter.escapable || workingLegs(this.player.body) === 0)
    ) {
      return '此戰無法逃離，或雙腿已無法支撐撤退。';
    }
    return null;
  }

  private resolvePlayer(action: BattleAction, events: BattleEvent[]): void {
    if (action.type === 'attack') {
      const noHands = workingHands(this.player.body) === 0;
      this.hitEnemy(
        action.target,
        noHands ? 0.65 : 1,
        noHands ? '應急踢擊' : '普通攻擊',
        noHands ? { hands: 0, legs: 1 } : { hands: 1, legs: 0 },
        events,
      );
    } else if (action.type === 'skill') {
      const skill = SKILLS[this.player.route].find((entry) => entry.id === action.skill)!;
      this.player.mp -= skill.cost;
      if (skill.effect === 'counter') {
        this.defending = true;
        this.counter = true;
        events.push({
          text: `${this.player.name}使出${skill.name}，護體待敵。`,
          source: 'player',
          kind: 'guard',
        });
      } else {
        this.hitEnemy(action.target, skill.multiplier, skill.name, skill.limbs, events);
        if (skill.effect === 'break') {
          this.enemies[action.target].broken = 2;
        }
      }
    } else if (action.type === 'item') {
      useMedicine(this.player, action.item);
      events.push({
        text: `使用${ITEMS[action.item].name}。藥品恢復生命，但不能接骨。`,
        source: 'player',
        kind: 'heal',
      });
    } else if (action.type === 'defend') {
      this.defending = true;
      events.push({
        text: '收勢防守，直到下一次出手前減傷 60%。',
        source: 'player',
        kind: 'guard',
      });
    } else {
      const chance = workingLegs(this.player.body) === 1 ? 0.35 : 0.75;
      if (this.random() < chance) {
        this.result = 'escaped';
        events.push({ text: '成功撤離，保留本場消耗與傷勢。' });
      } else {
        events.push({ text: '撤退失敗。' });
      }
    }
  }

  private hitEnemy(
    index: number,
    multiplier: number,
    label: string,
    requirement: LimbRequirement,
    events: BattleEvent[],
  ): void {
    const enemy = this.enemies[index];
    const power = limbPower(this.player.body, requirement);
    const defense = enemy.stats.defense * (enemy.broken > 0 ? 0.4 : 1);
    const base = Math.max(1, Math.round(this.stats.attack * multiplier - defense * 0.65));
    const damage = power > 0 ? Math.max(1, Math.round(base * power)) : 0;
    enemy.hp = Math.max(0, enemy.hp - damage);
    const disabled = damagePart(enemy.body, this.targetPart, (damage * 100) / enemy.stats.maxHp);
    events.push({
      text: `${this.player.name}使出${label}，命中${enemy.name}的${PART_NAMES[this.targetPart]}，造成 ${damage} 傷害${power < 1 ? `（肢體效能 ${Math.round(power * 100)}%）` : ''}。`,
      source: 'player',
      target: index,
      part: this.targetPart,
      amount: damage,
      kind: 'damage',
    });
    if (disabled) {
      events.push({
        text: `${enemy.name}的${PART_NAMES[this.targetPart]}已重傷。`,
        target: index,
        part: this.targetPart,
        kind: 'injury',
      });
    }
  }

  private resolveEnemy(index: number, events: BattleEvent[]): void {
    const enemy = this.enemies[index];
    const heavy = this.isHeavy(enemy);
    const noHands = workingHands(enemy.body) === 0;
    const requirement: LimbRequirement = noHands
      ? { hands: 0, legs: 1 }
      : { hands: heavy ? 2 : 1, legs: 0 };
    const power = limbPower(enemy.body, requirement);
    const base = Math.max(
      1,
      Math.round(
        enemy.stats.attack * (noHands ? 0.65 : heavy ? 2.1 : 1) - this.stats.defense * 0.65,
      ),
    );
    const damage =
      power > 0 ? Math.max(1, Math.round(base * power * (this.defending ? 0.4 : 1))) : 0;
    const parts: BodyPart[] = [
      'chest',
      'abdomen',
      'leftArm',
      'rightArm',
      'leftLeg',
      'rightLeg',
      'chest',
      'head',
    ];
    const part = parts[Math.min(parts.length - 1, Math.floor(this.random() * parts.length))];
    this.player.hp = Math.max(0, this.player.hp - damage);
    const disabled = damagePart(this.player.body, part, (damage * 100) / this.stats.maxHp);
    events.push({
      text: `${enemy.name}${noHands ? '踢擊' : heavy ? '重擊' : '普攻'}命中你的${PART_NAMES[part]}，造成 ${damage} 傷害${this.defending ? '（已減傷）' : ''}。`,
      source: index,
      target: 'player',
      part,
      amount: damage,
      kind: 'damage',
    });
    if (disabled) {
      events.push({
        text: `你的${PART_NAMES[part]}已重傷，請留意可用招式與移動姿態。`,
        target: 'player',
        part,
        kind: 'injury',
      });
    }
    if (this.counter && this.player.hp > 0) {
      this.hitEnemy(index, 0.85, '護體反擊', { hands: 1, legs: 0 }, events);
    }
  }

  private isHeavy(enemy: BattleEnemy): boolean {
    return (enemy.actions + 1) % ENEMIES[enemy.id].heavyEvery === 0;
  }

  private checkResult(events: BattleEvent[]): void {
    if (this.result) {
      return;
    }
    if (
      this.player.hp <= 0 ||
      (workingHands(this.player.body) === 0 && workingLegs(this.player.body) === 0)
    ) {
      this.result = 'defeat';
      events.push({ text: '已無法繼續戰鬥，退回安全處治療。' });
    } else if (this.enemies.every((enemy) => enemy.hp <= 0)) {
      this.result = 'victory';
      events.push({ text: '對手已敗退。' });
    }
  }
}
