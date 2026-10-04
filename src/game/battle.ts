import { ENCOUNTERS, ENEMIES, ITEMS, SKILLS } from '../data/content';
import { CombatClock } from './CombatClock';
import {
  createBody,
  damagePart,
  limbPower,
  movementRate,
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

export type AttackRange = { min: number; max: number };
export interface PlayerStrike {
  action: BattleAction;
  remaining: number;
  range: AttackRange;
  part: BodyPart;
  empowered: boolean;
}

export interface BattleEnemy {
  id: string;
  level?: number;
  name: string;
  hp: number;
  stats: Stats;
  body: BodyState;
  progress: number;
  actions: number;
  broken: number;
  opening: boolean;
  position: number;
  stamina: number;
  exhausted: boolean;
  windup: number;
  recovery: number;
  strikeRange: AttackRange | null;
  color: number;
}
export interface BattleEvent {
  text: string;
  source?: number | 'player';
  target?: number | 'player';
  part?: BodyPart;
  amount?: number;
  blocked?: number;
  opening?: boolean;
  skill?: string;
  heavy?: boolean;
  move?: string;
  style?: 'sword' | 'fist';
  kind?: 'damage' | 'heal' | 'guard' | 'injury' | 'windup' | 'miss' | 'talent';
}
export type BattleResult = 'victory' | 'defeat' | 'escaped' | null;

// 固定戰場邊界；起始位置與最大戰術距離都落在這段路面內。
export const BATTLE_LEFT = 7.5;
export const BATTLE_RIGHT = 19.2;

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
  momentum = 0;
  playerPosition = 10;
  desiredDistance: number;
  stamina = 100;
  exhausted = false;
  strike: PlayerStrike | null = null;
  recovery = 0;
  holdingPosition = false;
  guardCooldown = 0;
  guarding = false;
  events: BattleEvent[] = [];
  private pending: BattleAction | null = null;
  private immediateEvents: BattleEvent[] = [];
  /** Separate group tells without shortening any opponent's readable windup. */
  private enemyTellDelay = 0;

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
    this.desiredDistance = state.route === 'sword' ? 3.6 : 2.2;
    this.enemies = encounter.enemies.map((id, index) => ({
      id,
      name: ENEMIES[id].name,
      hp: ENEMIES[id].maxHp,
      stats: ENEMIES[id],
      body: createBody(),
      progress: 0,
      color: ENEMIES[id].color,
      actions: 0,
      broken: 0,
      opening: false,
      position: 16 + index * 1.6,
      stamina: 100,
      exhausted: false,
      windup: 0,
      recovery: 0,
      strikeRange: null,
    }));
    this.events.push({
      text: '戰術暫停中。選擇敵人與部位，再開始交鋒。蓄勢完成會自動普攻，招式可預約下一次出手。',
    });
  }

  get queuedAction(): BattleAction | null {
    const action =
      this.pending ?? this.strike?.action ?? (this.guarding ? { type: 'defend' as const } : null);
    return action ? { ...action } : null;
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
    if (enemy.hp <= 0) {
      return '已敗退';
    }
    if (enemy.strikeRange) {
      return `${this.isHeavy(enemy) ? `${this.heavyMove(enemy)} · 重擊` : '攻擊'}起手 ${Math.max(0, enemy.windup).toFixed(1)}秒`;
    }
    if (enemy.opening) {
      return `破綻露出 · 追擊傷害 +${this.player.talents.includes('opening') ? 55 : 35}%`;
    }
    if (workingHands(enemy.body) === 0) {
      return '雙手失能 · 改以腿法';
    }
    return this.isHeavy(enemy)
      ? `${this.heavyMove(enemy)} · ${this.heavyHint(enemy)}`
      : '普通攻擊 · 單手';
  }

  preparingHeavy(index: number): boolean {
    const enemy = this.enemies[index];
    return enemy.hp > 0 && !!enemy.strikeRange && this.isHeavy(enemy);
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
    if (action.type === 'defend') {
      if (this.guardCooldown > 0) {
        return '正在收勢，稍候才能再次防禦。';
      }
      if (this.stamina < 20) {
        return '腳力不足，需要 20 點才能收勢防禦。';
      }
      this.stamina -= 20;
      this.guardCooldown = 1;
      this.strike = null;
      this.pending = null;
      this.playerProgress = 0;
      this.recovery = 0.2;
      this.defending = true;
      this.guarding = true;
      this.counter = false;
      this.paused = false;
      this.immediateEvents.push({
        text: '收勢防守，消耗 20 腳力；下次出手前減傷 60%。',
        source: 'player',
        kind: 'guard',
      });
      return null;
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
    const emitted: BattleEvent[] = this.immediateEvents.splice(0);
    this.clock.advance(seconds, (dt) => {
      this.moveFighters(dt);
      this.enemyTellDelay = Math.max(0, this.enemyTellDelay - dt);
      this.guardCooldown = Math.max(0, this.guardCooldown - dt);
      this.recovery = Math.max(0, this.recovery - dt);
      if (this.strike) {
        this.strike.remaining -= dt;
        if (this.strike.remaining <= 1e-8) {
          const strike = this.strike;
          this.strike = null;
          const action = strike.action;
          if (
            'target' in action &&
            (!this.enemies[action.target]?.hp || !this.inRange(action.target, strike.range))
          ) {
            emitted.push({ text: '對手退出射程，這一招落空。', source: 'player', kind: 'miss' });
          } else if (action.type === 'skill' && this.skillPower(action.skill) === 0) {
            emitted.push({ text: '起招後肢體失能，招式中斷。', source: 'player', kind: 'miss' });
          } else {
            this.resolvePlayer(action, emitted, strike.empowered, strike.part);
          }
          this.recovery = 0.35;
          this.checkResult(emitted);
        }
      } else if (this.recovery === 0) {
        this.playerProgress = Math.min(
          1,
          this.playerProgress + dt / this.interval(this.stats.speed),
        );
        if (this.playerProgress >= 1 && (this.pending || (this.autoAttack && !this.guarding))) {
          const action = this.pending ?? { type: 'attack' as const, target: this.aliveTarget() };
          const error = this.validate(action);
          const offensive =
            action.type === 'attack' || (action.type === 'skill' && action.skill !== 'guard');
          const range = this.attackRange(action.type === 'skill' ? action.skill : undefined);
          if (error) {
            this.pending = null;
            this.playerProgress = 0;
            emitted.push({ text: error });
          } else if (!offensive || ('target' in action && this.inRange(action.target, range))) {
            this.pending = null;
            this.playerProgress = 0;
            this.defending = false;
            this.guarding = false;
            this.counter = false;
            if (action.type === 'skill') {
              this.player.mp -= SKILLS[this.player.route].find(
                (skill) => skill.id === action.skill,
              )!.cost;
            }
            if (offensive) {
              const empowered = action.type === 'skill' && this.momentum === 3;
              if (empowered) {
                this.momentum = 0;
              }
              this.strike = {
                action,
                remaining: action.type === 'skill' ? 0.7 : 0.45,
                range,
                part: this.targetPart,
                empowered,
              };
              emitted.push({
                text: '正在起招，命中前仍需保持射程。',
                source: 'player',
                target: 'target' in action ? action.target : undefined,
                skill: action.type === 'skill' ? action.skill : undefined,
                part: this.strike.part,
                kind: 'windup',
              });
            } else {
              this.resolvePlayer(action, emitted);
              this.checkResult(emitted);
            }
          }
        }
      }
      for (const [index, enemy] of this.enemies.entries()) {
        if (this.result) {
          break;
        }
        if (enemy.hp <= 0) {
          continue;
        }
        enemy.recovery = Math.max(0, enemy.recovery - dt);
        if (enemy.strikeRange) {
          enemy.windup -= dt;
          if (enemy.windup <= 1e-8) {
            const range = enemy.strikeRange;
            enemy.strikeRange = null;
            enemy.opening = this.isHeavy(enemy) && workingHands(enemy.body) > 0;
            if (this.inRange(index, range)) {
              this.resolveEnemy(index, emitted);
            } else {
              emitted.push({
                text: `${enemy.name}攻擊落空，你已退出射程。`,
                source: index,
                kind: 'miss',
              });
              if (
                this.isHeavy(enemy) &&
                workingHands(enemy.body) > 0 &&
                this.player.talents.includes('footwork')
              ) {
                const recovered = Math.min(15, 100 - this.stamina);
                this.stamina += recovered;
                if (recovered > 0) {
                  emitted.push({
                    text: `游身卸力 · 避開重擊，恢復 ${Math.floor(recovered)} 腳力。`,
                    kind: 'talent',
                  });
                }
              }
            }
            enemy.actions++;
            enemy.broken = Math.max(0, enemy.broken - 1);
            enemy.recovery = 0.4;
            this.checkResult(emitted);
          }
        } else if (enemy.recovery === 0) {
          enemy.progress = Math.min(1, enemy.progress + dt / this.interval(enemy.stats.speed));
          if (
            enemy.progress >= 1 &&
            this.enemyTellDelay <= 1e-8 &&
            this.inRange(index, this.enemyRange(index))
          ) {
            // Leave room for the first attacker to withdraw before the next
            // contact. This also keeps overlapping tells readable in a group.
            this.enemyTellDelay = 0.65;
            enemy.progress = 0;
            enemy.opening = false;
            enemy.strikeRange = this.enemyRange(index);
            enemy.windup = this.isHeavy(enemy) ? this.heavyWindup(enemy) : 0.5;
            emitted.push({
              text: `${enemy.name}${this.isHeavy(enemy) ? `準備${this.heavyMove(enemy)}，${this.heavyHint(enemy)}。` : '攻擊起手，可拉開距離閃避。'}`,
              source: index,
              target: 'player',
              heavy: this.isHeavy(enemy),
              move: this.isHeavy(enemy) ? this.heavyMove(enemy) : undefined,
              kind: 'windup',
            });
          }
        }
      }
      return !this.result;
    });
    this.events.push(...emitted);
    this.events = this.events.slice(-8);
    return emitted;
  }

  distance(index = this.target): number {
    return Math.abs(this.enemies[index].position - this.playerPosition);
  }

  attackRange(skill?: string): AttackRange {
    if (workingHands(this.player.body) === 0) {
      return { min: 1, max: 2.5 };
    }
    if (skill === 'swordfall') {
      return { min: 2, max: 5.8 };
    }
    if (skill === 'dragon') {
      return { min: 1, max: 3.8 };
    }
    return (this.player.weapon ?? (this.player.route === 'sword' ? 'sword' : 'wraps')) === 'sword'
      ? { min: 2, max: 5 }
      : { min: 1, max: 3 };
  }

  enemyRange(index: number): AttackRange {
    const enemy = this.enemies[index];
    if (workingHands(enemy.body) === 0) {
      return { min: 1, max: 2.5 };
    }
    if (enemy.id === 'boss') {
      return { min: 2, max: 5 };
    }
    if (enemy.id === 'bandit') {
      return { min: 1.5, max: this.isHeavy(enemy) ? 4.5 : 4 };
    }
    if (enemy.id === 'zombie') {
      return { min: 1, max: this.isHeavy(enemy) ? 2.7 : 3 };
    }
    return { min: 1, max: 3 };
  }

  inRange(index: number, range: AttackRange): boolean {
    const distance = this.distance(index);
    return distance >= range.min - 1e-6 && distance <= range.max + 1e-6;
  }

  setDistance(value: number): void {
    if (Number.isFinite(value) && !this.result) {
      this.holdingPosition = false;
      // 近身指令仍需留出目前兵器的出手空間，否則持劍追到牆邊會互卡。
      this.desiredDistance = Math.max(this.attackRange().min, Math.min(10, value));
    }
  }

  private moveFighters(dt: number): void {
    this.aliveTarget();
    this.exhausted = this.exhausted ? this.stamina < 30 : this.stamina < 1;
    const delta = this.distance() - this.desiredDistance;
    const direction =
      (Math.abs(delta) > 0.12 || (delta < 0 && this.distance() < this.attackRange().min)) &&
      !this.holdingPosition &&
      !this.strike &&
      !this.recovery &&
      !this.exhausted
        ? Math.sign(delta)
        : 0;
    const speed = (1.8 + this.stats.speed * 0.025) * movementRate(this.player.body);
    const old = this.playerPosition;
    const nearest = Math.min(
      ...this.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => enemy.position),
    );
    this.playerPosition = Math.max(
      BATTLE_LEFT,
      Math.min(
        BATTLE_RIGHT - 1,
        nearest - 1,
        this.playerPosition + direction * Math.min(Math.abs(delta), speed * dt),
      ),
    );
    this.stamina = Math.max(
      0,
      Math.min(
        100,
        this.stamina + (old !== this.playerPosition ? -(direction < 0 ? 24 : 16) : 22) * dt,
      ),
    );
    for (const [index, enemy] of this.enemies.entries()) {
      if (enemy.hp <= 0) {
        continue;
      }
      enemy.exhausted = enemy.exhausted ? enemy.stamina < 30 : enemy.stamina < 1;
      const range = this.enemyRange(index);
      const desired = (range.min + range.max) / 2;
      const gap = this.distance(index) - desired;
      // 已有有效站位就穩住；不要為了追逐中點不停後退，令短兵器每次起招都落空。
      const needsMove =
        this.distance(index) < range.min + 0.2 || this.distance(index) > range.max - 0.35;
      const direction =
        needsMove &&
        Math.abs(gap) > 0.15 &&
        !enemy.strikeRange &&
        !enemy.recovery &&
        !enemy.exhausted
          ? -Math.sign(gap)
          : 0;
      const old = enemy.position;
      const speed = (1.2 + enemy.stats.speed * 0.03) * movementRate(enemy.body);
      enemy.position = Math.max(
        this.playerPosition + 1,
        Math.min(BATTLE_RIGHT, enemy.position + direction * Math.min(Math.abs(gap), speed * dt)),
      );
      enemy.stamina = Math.max(
        0,
        Math.min(
          100,
          enemy.stamina + (old !== enemy.position ? -(direction > 0 ? 24 : 16) : 22) * dt,
        ),
      );
    }
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

  private resolvePlayer(
    action: BattleAction,
    events: BattleEvent[],
    empowered = false,
    part = this.targetPart,
  ): void {
    if (action.type === 'attack') {
      const noHands = workingHands(this.player.body) === 0;
      this.hitEnemy(
        action.target,
        noHands ? 0.65 : 1,
        noHands ? '應急踢擊' : '普通攻擊',
        noHands ? { hands: 0, legs: 1 } : { hands: 1, legs: 0 },
        events,
        part,
      );
      this.gainMomentum(events);
    } else if (action.type === 'skill') {
      const skill = SKILLS[this.player.route].find((entry) => entry.id === action.skill)!;
      if (skill.effect === 'counter') {
        this.defending = true;
        this.counter = true;
        events.push({
          text: `${this.player.name}使出${skill.name}，護體待敵。`,
          source: 'player',
          skill: skill.id,
          kind: 'guard',
        });
      } else {
        this.hitEnemy(
          action.target,
          skill.multiplier * (empowered ? 1.35 : 1),
          `${empowered ? '氣勢爆發 · ' : ''}${skill.name}`,
          skill.limbs,
          events,
          part,
          skill.id,
        );
        const enemy = this.enemies[action.target];
        if (empowered && enemy.hp > 0) {
          enemy.progress = Math.max(0, enemy.progress - 0.5);
          events.push({ text: `${enemy.name}出手受阻，蓄勢減少 50%。` });
        }
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
    part = this.targetPart,
    skill?: string,
  ): void {
    const enemy = this.enemies[index];
    const power = limbPower(this.player.body, requirement);
    const defense = enemy.stats.defense * (enemy.broken > 0 ? 0.4 : 1);
    const opening = enemy.opening;
    const base = Math.max(
      1,
      Math.round(
        (this.stats.attack * multiplier * (this.player.body.head === 0 ? 0.7 : 1) -
          defense * 0.65) *
          (opening ? (this.player.talents.includes('opening') ? 1.55 : 1.35) : 1),
      ),
    );
    const damage = power > 0 ? Math.max(1, Math.round(base * power)) : 0;
    if (damage > 0) {
      enemy.opening = false;
    }
    enemy.hp = Math.max(0, enemy.hp - damage);
    const disabled = damagePart(enemy.body, part, (damage * 100) / enemy.stats.maxHp);
    events.push({
      text: `${this.player.name}使出${label}${opening ? '（追擊破綻）' : ''}，命中${enemy.name}的${PART_NAMES[part]}，造成 ${damage} 傷害${power < 1 ? `（肢體效能 ${Math.round(power * 100)}%）` : ''}。`,
      source: 'player',
      target: index,
      part: part,
      amount: damage,
      skill,
      opening,
      style: this.player.weapon === 'sword' ? 'sword' : this.player.route,
      kind: 'damage',
    });
    if (disabled) {
      if (part === 'head') {
        enemy.strikeRange = null;
        enemy.windup = 0;
        enemy.progress = 0;
        enemy.recovery = Math.max(enemy.recovery, 1.2);
        enemy.opening = true;
      }
      events.push({
        text: part === 'head'
          ? `${enemy.name}頭部重傷，攻勢中斷，露出破綻。`
          : `${enemy.name}的${PART_NAMES[part]}已重傷。`,
        target: index,
        part: part,
        kind: 'injury',
      });
    }
  }

  private resolveEnemy(index: number, events: BattleEvent[]): void {
    const enemy = this.enemies[index];
    const heavy = this.isHeavy(enemy);
    const noHands = workingHands(enemy.body) === 0;
    enemy.opening = heavy && !noHands;
    const requirement: LimbRequirement = noHands
      ? { hands: 0, legs: 1 }
      : { hands: heavy ? 2 : 1, legs: 0 };
    const power = limbPower(enemy.body, requirement);
    const heavyMultiplier =
      enemy.id === 'disciple'
        ? 1.55
        : enemy.id === 'zombie'
          ? 1.7
          : enemy.id === 'bandit'
            ? 1.9
            : enemy.hp <= enemy.stats.maxHp / 2
              ? 2.35
              : 2.1;
    const base = Math.max(
      1,
      Math.round(
        enemy.stats.attack *
          (noHands ? 0.65 : heavy ? heavyMultiplier : 1) *
          (enemy.body.head === 0 ? 0.7 : 1) -
          this.stats.defense * 0.65,
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
    const part =
      heavy && enemy.id === 'bandit'
        ? this.random() < 0.5
          ? 'leftLeg'
          : 'rightLeg'
        : heavy && enemy.id === 'zombie'
          ? this.random() < 0.5
            ? 'leftArm'
            : 'rightArm'
          : parts[Math.min(parts.length - 1, Math.floor(this.random() * parts.length))];
    this.player.hp = Math.max(0, this.player.hp - damage);
    const disabled = damagePart(this.player.body, part, (damage * 100) / this.stats.maxHp);
    events.push({
      text: `${enemy.name}${noHands ? '踢擊' : heavy ? this.heavyMove(enemy) : '普攻'}命中你的${PART_NAMES[part]}，造成 ${damage} 傷害${this.defending ? '（已減傷）' : ''}。`,
      source: index,
      target: 'player',
      part,
      amount: damage,
      heavy,
      blocked: this.defending ? Math.max(0, Math.round(base * power) - damage) : 0,
      move: heavy ? this.heavyMove(enemy) : undefined,
      kind: 'damage',
    });
    if (heavy && enemy.id === 'zombie' && damage > 0) {
      this.stamina = Math.max(0, this.stamina - 24);
      events.push({ text: '失心傀儡纏住身形，腳力減少 24。' });
    }
    if (disabled) {
      if (part === 'head') {
        this.strike = null;
        this.playerProgress = 0;
        this.recovery = Math.max(this.recovery, 1.2);
        this.counter = false;
      }
      events.push({
        text: part === 'head'
          ? '你的頭部重傷，起招中斷且攻擊力降低。'
          : `你的${PART_NAMES[part]}已重傷，請留意可用招式與移動姿態。`,
        target: 'player',
        part,
        kind: 'injury',
      });
    }
    if (this.defending && damage > 0 && this.player.hp > 0) {
      this.gainMomentum(events);
      if (heavy && !noHands && this.player.talents.includes('breath')) {
        const recovered = Math.min(4, this.stats.maxMp - this.player.mp);
        this.player.mp += recovered;
        if (recovered > 0) {
          events.push({ text: `守中養氣 · 接下重擊，恢復 ${recovered} 內力。`, kind: 'talent' });
        }
      }
    }
    this.guarding = false;
    if (this.counter && this.player.hp > 0 && this.inRange(index, this.attackRange())) {
      this.hitEnemy(
        index,
        SKILLS.fist.find((skill) => skill.effect === 'counter')!.multiplier,
        '護體反擊',
        { hands: 1, legs: 0 },
        events,
      );
    }
  }

  private isHeavy(enemy: BattleEnemy): boolean {
    return (enemy.actions + 1) % ENEMIES[enemy.id].heavyEvery === 0;
  }

  private heavyMove(enemy: BattleEnemy): string {
    return (
      {
        disciple: '試勢直掌',
        bandit: '斷腿橫掃',
        zombie: '縛臂陰爪',
        boss: enemy.hp <= enemy.stats.maxHp / 2 ? '焚心劍・絕境' : '焚心劍',
      }[enemy.id] ?? '重擊'
    );
  }

  private heavyHint(enemy: BattleEnemy): string {
    return (
      {
        disciple: '收勢防禦或退開',
        bandit: '會掃腿，拉開距離',
        zombie: '會傷手並耗腳力',
        boss: '長距離劍氣，退遠或防禦',
      }[enemy.id] ?? '可防禦或退開'
    );
  }

  private heavyWindup(enemy: BattleEnemy): number {
    return { disciple: 1.8, bandit: 0.9, zombie: 1.35, boss: 1 }[enemy.id] ?? 1;
  }

  private gainMomentum(events: BattleEvent[]): void {
    if (this.momentum < 3) {
      this.momentum++;
      if (this.momentum === 3) {
        events.push({ text: '氣勢已滿！下一次攻擊招式威力提升 35%，並延遲敵人半條蓄勢。' });
      }
    }
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
