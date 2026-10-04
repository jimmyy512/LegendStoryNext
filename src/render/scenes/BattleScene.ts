import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { MAPS } from '../../data/maps';
import { BATTLE_LEFT, BATTLE_RIGHT, type Battle, type BattleEvent } from '../../game/battle';
import { opponentName } from '../../game/opponentName';
import { text } from '../art';
import { BattleEffects } from '../BattleEffects';
import { PixelBattleHero } from '../PixelBattleHero';
import { PixelEnemy } from '../PixelEnemy';
import { ContactStep } from '../ContactStep';
import { PixiScene } from './PixiScene';

// The authored arenas share a clear floor between these foot positions.
// Keep logical combat distances independent of the illustration's foreground rocks.
const GROUND_Y = 415;
const LANE_DEPTH = 60;
// Project parallel combat lanes diagonally so enemies at the same range do not
// cover each other's torso and weapon. Simulation distances remain on their lane.
const LANE_STAGGER = 112;
const YIELD_SPACE = 90;
const stageX = (position: number): number =>
  300 + ((position - BATTLE_LEFT) / (BATTLE_RIGHT - BATTLE_LEFT)) * 700;
const fighterX = (position: number, id: number | 'player'): number =>
  stageX(position) + (typeof id === 'number' ? id * LANE_STAGGER : 0);

type Fighter = {
  node: PixelEnemy | PixelBattleHero;
  name: Text;
  ring: Graphics;
  progress: Graphics;
  position: number;
  movingUntil: number;
  body: string;
  hit: number;
  windup: number;
  labelOffset: number;
  cameraLeft: number;
  cameraRight: number;
  step: ContactStep;
  wasStriking: boolean;
};

export class BattleScene extends PixiScene {
  onTarget: (index: number) => void = () => {};
  readonly artBounds = { left: -99, right: 1251, top: -130, bottom: 630 };
  private battle: Battle | null = null;
  private fighters = new Map<number | 'player', Fighter>();
  private effects = new BattleEffects((id) => this.fighters.get(id)?.node);
  private running = false;
  private elapsed = 0;
  private selected = 0;
  private impactPause = 0;
  private impactShake = 0;
  private backdropArt = new Container();

  get finished(): boolean {
    return Boolean(this.battle?.result);
  }

  get cameraBounds(): { x: number; width: number; y: number; poseWidth?: number } {
    const visible = [...this.fighters.values()].filter(
      (_, i) => this.battle!.result || i === 0 || this.battle!.enemies[i - 1].hp > 0,
    );
    const baseX = (fighter: Fighter) =>
      fighterX(
        fighter.position,
        [...this.fighters.entries()].find(([, value]) => value === fighter)![0],
      );
    // Attack approaches stay within the normal staging envelope. Do not zoom
    // in on each lunge and back out during its recovery.
    const xs = visible.map(baseX);
    const left = Math.min(...xs),
      right = Math.max(...xs);
    // Retain each actor's largest observed pose to avoid zoom pulsing with every swing.
    for (const fighter of visible) {
      const bounds = fighter.node.getLocalBounds();
      fighter.cameraLeft = Math.min(fighter.cameraLeft, bounds.x * fighter.node.scale.x);
      fighter.cameraRight = Math.max(
        fighter.cameraRight,
        (bounds.x + bounds.width) * fighter.node.scale.x,
      );
    }
    const poseLeft = Math.min(...visible.map((f) => baseX(f) + f.cameraLeft));
    const poseRight = Math.max(
      ...visible.map(
        (f) => baseX(f) + f.cameraRight + (f.node instanceof PixelEnemy ? YIELD_SPACE : 0),
      ),
    );
    return {
      x: (poseLeft + poseRight) / 2,
      width: Math.max(560, right - left + 440),
      y: GROUND_Y - 70 + (this.battle!.enemies.length - 1) * LANE_DEPTH * 0.4,
      poseWidth: poseRight - poseLeft + 72,
    };
  }

  coverBackdrop(top: number, bottom: number): void {
    const ground = GROUND_Y;
    const scale = Math.max(
      1,
      (ground - top) / (ground - this.artBounds.top),
      (bottom - ground) / (this.artBounds.bottom - ground),
    );
    // Scale uniformly around the ground plane; preserve the illustration's proportions.
    this.backdropArt.scale.set(scale);
  }
  setRunning(running: boolean): void {
    this.running = running;
  }
  showBattle(battle: Battle, selected: number): void {
    this.selected = selected;
    if (this.battle === battle) {
      this.sync();
      return;
    }
    this.battle = battle;
    this.clear();
    this.fighters.clear();
    this.elapsed = 0;
    this.impactPause = 0;
    this.impactShake = 0;
    this.root.position.set(0, 0);
    this.root.sortableChildren = true;
    const map = MAPS[battle.player.map];
    const backdrop = new Graphics().rect(-3000, -2000, 7000, 5000).fill(map.palette.dark);
    const texture = Assets.get<Texture>(`battle:${map.id}`);
    texture.source.scaleMode = 'nearest';
    const arena = new Sprite(texture);
    arena.position.set(this.artBounds.left, this.artBounds.top);
    arena.width = this.artBounds.right - this.artBounds.left;
    arena.height = this.artBounds.bottom - this.artBounds.top;
    const edgeLeft = new Sprite(texture);
    edgeLeft.scale.set(-arena.scale.x, arena.scale.y);
    edgeLeft.position.set(arena.x, arena.y);
    const edgeRight = new Sprite(texture);
    edgeRight.scale.set(-arena.scale.x, arena.scale.y);
    edgeRight.position.set(arena.x + arena.width * 2, arena.y);
    this.backdropArt = new Container();
    this.backdropArt.pivot.set(576, GROUND_Y);
    this.backdropArt.position.set(576, GROUND_Y);
    this.backdropArt.addChild(edgeLeft, edgeRight, arena);
    this.root.addChild(backdrop, this.backdropArt);
    const ids: (number | 'player')[] = ['player', ...battle.enemies.map((_, i) => i)];
    for (const id of ids) {
      const enemy = id === 'player' ? null : battle.enemies[id];
      const node = enemy
        ? new PixelEnemy(enemy.id, enemy.body)
        : new PixelBattleHero(battle.player);
      node.scale.set(enemy ? 1 : 1.45);
      node.faceDirection(enemy ? -1 : 1);
      const position = enemy?.position ?? battle.playerPosition;
      node.position.set(
        fighterX(position, id),
        GROUND_Y + (typeof id === 'number' ? id * LANE_DEPTH : 0),
      );
      const ring = new Graphics(),
        progress = new Graphics(),
        name = text(
          typeof id === 'number' ? opponentName(battle.enemies, id) : battle.player.name,
          18,
        );
      name.style.stroke = { color: 0x102322, width: 4 };
      ring.zIndex = 900;
      name.zIndex = 3000;
      progress.zIndex = 3000;
      name.anchor.set(0.5);
      node.eventMode = enemy ? 'static' : 'none';
      node.cursor = enemy ? 'pointer' : 'default';
      if (typeof id === 'number') {
        node.on('pointertap', (e) => {
          e.stopPropagation();
          if (battle.enemies[id].hp > 0) {
            this.onTarget(id);
          }
        });
      }
      this.root.addChild(ring, node, name, progress);
      this.fighters.set(id, {
        node,
        name,
        ring,
        progress,
        position,
        movingUntil: 0,
        body: '',
        hit: 0,
        windup: 0,
        step: new ContactStep(),
        wasStriking: false,
        cameraLeft: -60,
        cameraRight: 60,
        labelOffset:
          typeof id === 'number' && id < battle.enemies.length - 1
            ? node.getLocalBounds().y - 20
            : 25,
      });
    }
    this.effects = new BattleEffects((id) => this.fighters.get(id)?.node);
    this.effects.zIndex = 4000;
    this.root.addChild(this.effects);
    this.sync();
    this.place(0, true);
  }
  private sync(): void {
    const b = this.battle!;
    for (const [id, f] of this.fighters) {
      const body = id === 'player' ? b.player.body : b.enemies[id].body;
      const enemy = id === 'player' ? null : b.enemies[id];
      const key = JSON.stringify([body, enemy ? enemy.hp <= 0 : b.player.hp <= 0]);
      if (key !== f.body) {
        if (enemy) {
          (f.node as PixelEnemy).setBody(body, enemy.hp);
        } else {
          (f.node as PixelBattleHero).setState(b.player);
        }
        f.body = key;
      }
      f.ring.visible = !enemy || enemy.hp > 0;
      f.progress.visible = !enemy || enemy.hp > 0;
      f.name.alpha = id !== 'player' && b.enemies[id].hp <= 0 ? 0.35 : 1;
    }
  }
  private place(dt: number, snap = false): void {
    const b = this.battle!;
    for (const [id, f] of this.fighters) {
      const enemy = id === 'player' ? null : b.enemies[id];
      const position = enemy?.position ?? b.playerPosition;
      if (Math.abs(position - f.position) > 0.0001) {
        f.movingUntil = this.elapsed + 0.12;
      }
      f.position = position;
      const striking = enemy ? !!enemy.strikeRange : !!b.strike;
      if (f.wasStriking && !striking) {
        f.step.cancel();
      }
      f.wasStriking = striking;
      const targeted =
        id === 'player'
          ? b.enemies.some((opponent) => opponent.hp > 0 && !!opponent.strikeRange)
          : !!b.strike && 'target' in b.strike.action && b.strike.action.target === id;
      f.step.update(dt, targeted);
      if (enemy) {
        (f.node as PixelEnemy).setPreparing(striking);
      } else {
        (f.node as PixelBattleHero).setPreparing(striking);
      }
      f.node.setMoving(!striking && this.elapsed < f.movingUntil);
      // The waiting opponent yields the front of the exchange instead of
      // standing inside the active attacker's silhouette.
      const yieldSpace =
        enemy &&
        enemy.hp > 0 &&
        !striking &&
        Math.abs(f.step.x) < 1 &&
        b.enemies.some(
          (opponent, index) => index !== id && opponent.hp > 0 && !!opponent.strikeRange,
        )
          ? YIELD_SPACE
          : 0;
      let target = fighterX(position, id) + f.step.x + yieldSpace;
      const targetY = GROUND_Y + (typeof id === 'number' ? id * LANE_DEPTH : 0) + f.step.y;
      const player = this.fighters.get('player')!;
      if (enemy && enemy.hp > 0 && Math.abs(targetY - player.node.y) < 90) {
        // Another opponent can move into the planned contact spot while this
        // attack is winding up. Keep bodies apart without changing hit rules.
        target = Math.max(target, player.node.x + 90);
      }
      const k = snap ? 1 : 1 - Math.exp(-18 * dt);
      const previousX = f.node.x;
      const previousY = f.node.y;
      f.node.x += (target - f.node.x) * k;
      f.node.y = targetY;
      if (f.node instanceof PixelBattleHero || f.node instanceof PixelEnemy) {
        f.node.setTravel(
          (f.node.x - previousX) / f.node.scale.x,
          (f.node.y - previousY) / f.node.scale.y,
          dt,
        );
      }
      f.node.zIndex = 1000 + targetY;
      if (f.hit > 0) {
        f.hit = Math.max(0, f.hit - dt);
        f.node.rotation = Math.sin(f.hit * 55) * 0.035;
        f.node.tint = 0xffbda8;
      } else {
        f.node.rotation = 0;
        f.node.tint = 0xffffff;
      }
      f.ring
        .clear()
        .ellipse(f.node.x, f.node.y + 5, 44, 12)
        .fill({ color: 0x071b17, alpha: 0.4 });
      if (id === this.selected && enemy?.hp) {
        f.ring.ellipse(f.node.x, f.node.y + 5, 52, 16).fill({ color: 0xd9bd81, alpha: 0.22 });
      }
      const labelY = f.node.y + f.labelOffset;
      f.name.position.set(f.node.x, labelY);
      const progress = enemy ? enemy.hp / enemy.stats.maxHp : b.player.hp / b.stats.maxHp;
      f.progress
        .clear()
        .roundRect(f.node.x - 42, labelY + 24, 84, 4, 2)
        .fill(0x1b322b)
        .roundRect(
          f.node.x - 42,
          labelY + 24,
          Math.max(0.1, 84 * Math.max(0, Math.min(1, progress))),
          4,
          2,
        )
        .fill(enemy ? 0xca8470 : 0x83c5ad);
    }
  }
  showEvents(events: BattleEvent[]): void {
    this.sync();
    for (const e of events) {
      if (e.kind === 'guard' && e.source !== undefined) {
        this.fighters.get(e.source)?.node.playGuard();
      }
      if (e.kind === 'windup' && e.source !== undefined) {
        const fighter = this.fighters.get(e.source);
        const actor = fighter?.node;
        const target = this.fighters.get(e.target ?? 'player');
        if (fighter && target) {
          const duration =
            e.source === 'player' ? (e.skill ? 0.7 : 0.45) : this.battle!.enemies[e.source].windup;
          const sourceX = fighterX(fighter.position, e.source);
          const targetId = e.target ?? 'player';
          const targetX = fighterX(target.position, targetId) + target.step.destination.x;
          const reach =
            e.source === 'player' ? (this.battle!.player.weapon === 'sword' ? 110 : 80) : 100;
          const direction = e.source === 'player' ? 1 : -1;
          const dx = direction * Math.max(0, direction * (targetX - sourceX) - reach);
          const sourceY = GROUND_Y + (typeof e.source === 'number' ? e.source * LANE_DEPTH : 0);
          const targetY =
            GROUND_Y +
            (typeof targetId === 'number' ? targetId * LANE_DEPTH : 0) +
            target.step.destination.y;
          const depth = typeof e.source === 'number' ? e.source * 45 : 0;
          fighter.step.start(dx, targetY - sourceY + depth, duration);
        }
        if (actor instanceof PixelBattleHero) {
          actor.playAttack(e.skill ? 0.7 : 0.45, e.part);
        } else {
          actor?.playAttack();
        }
      }
      if ((e.kind === 'damage' || e.kind === 'miss') && typeof e.source === 'number') {
        (this.fighters.get(e.source)?.node as PixelEnemy | undefined)?.playStrike();
      }
      if ((e.kind === 'damage' || e.kind === 'miss') && e.source === 'player') {
        (this.fighters.get('player')?.node as PixelBattleHero | undefined)?.playStrike();
      }
      if ((e.kind === 'damage' || e.kind === 'miss') && e.source !== undefined) {
        const fighter = this.fighters.get(e.source);
        if (fighter) {
          fighter.step.strike();
          fighter.wasStriking = false;
          fighter.node.position.set(
            fighterX(fighter.position, e.source) + fighter.step.x,
            GROUND_Y + (typeof e.source === 'number' ? e.source * LANE_DEPTH : 0) + fighter.step.y,
          );
          const player = this.fighters.get('player')!;
          if (typeof e.source === 'number' && Math.abs(fighter.node.y - player.node.y) < 90) {
            fighter.node.x = Math.max(fighter.node.x, player.node.x + 90);
          }
          fighter.node.zIndex = 1000 + fighter.node.y;
        }
      }
      if (e.kind === 'damage' && e.target !== undefined) {
        const target = this.fighters.get(e.target);
        if (target) {
          target.hit = 0.24;
          target.node.playHurt();
          this.impactPause = 0.045;
          this.impactShake = Math.min(0.22, this.impactShake + 0.14);
        }
      }
      this.effects.show(e);
    }
  }
  update(dt: number): void {
    if (!this.battle || !this.running) {
      return;
    }
    this.elapsed += dt;
    this.impactShake = Math.max(0, this.impactShake - dt);
    this.root.position.set(
      Math.sin(this.elapsed * 117) * this.impactShake * 24,
      Math.cos(this.elapsed * 93) * this.impactShake * 9,
    );
    if (this.impactPause > 0) {
      this.impactPause = Math.max(0, this.impactPause - dt);
    } else {
      this.place(dt);
      for (const f of this.fighters.values()) {
        f.node.update(dt);
      }
    }
    this.effects.update(dt);
  }
}
