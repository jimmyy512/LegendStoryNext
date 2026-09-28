import { Graphics, Text } from 'pixi.js';
import { MAPS } from '../../data/maps';
import type { Battle, BattleEvent } from '../../game/battle';
import { noise, text, tree, WIDTH } from '../art';
import { BattleEffects } from '../BattleEffects';
import { GameHero } from '../GameHero';
import { PixiScene } from './PixiScene';

type Fighter = {
  node: GameHero;
  name: Text;
  ring: Graphics;
  progress: Graphics;
  position: number;
  movingUntil: number;
  body: string;
  hit: number;
  windup: number;
};

export class BattleScene extends PixiScene {
  onTarget: (index: number) => void = () => {};
  private battle: Battle | null = null;
  private fighters = new Map<number | 'player', Fighter>();
  private effects = new BattleEffects((id) => this.fighters.get(id)?.node);
  private running = false;
  private elapsed = 0;
  private selected = 0;

  get cameraBounds(): { x: number; width: number; y: number } {
    const xs = [...this.fighters.values()]
      .filter((_, i) => this.battle!.result || i === 0 || this.battle!.enemies[i - 1].hp > 0)
      .map((f) => f.node.x);
    const left = Math.min(...xs),
      right = Math.max(...xs);
    return {
      x: (left + right) / 2,
      width: Math.max(560, right - left + 440),
      y: 385 + (this.battle!.enemies.length - 1) * 25,
    };
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
    const map = MAPS[battle.player.map];
    const g = new Graphics().rect(-3000, -2000, 7000, 5000).fill(map.palette.dark);
    const random = noise(62);
    for (let i = 0; i < 8; i++) {
      const base = 110 + i * 35;
      g.poly([
        -3000,
        base + 40,
        120,
        base - random() * 120,
        300,
        base + 10,
        490,
        base - 130,
        680,
        base - 50,
        890,
        base - random() * 140,
        4000,
        base,
        4000,
        2500,
        -3000,
        2500,
      ]).fill({ color: map.palette.ground, alpha: 0.25 + i * 0.07 });
    }
    g.ellipse(WIDTH / 2, 490, 470, 130).fill({ color: map.palette.path, alpha: 0.25 });
    g.ellipse(WIDTH / 2, 488, 450, 115).stroke({ color: 0xc8bb8e, alpha: 0.12, width: 2 });
    for (let i = 0; i < 60; i++) {
      g.ellipse(random() * WIDTH, 390 + random() * 260, 3 + random() * 12, 2).fill({
        color: map.palette.light,
        alpha: 0.15,
      });
    }
    this.root.addChild(g);
    this.root.addChild(tree(80, 410, 140, random), tree(1070, 430, 140, random));
    const ids: (number | 'player')[] = ['player', ...battle.enemies.map((_, i) => i)];
    for (const id of ids) {
      const enemy = id === 'player' ? null : battle.enemies[id];
      const state = enemy
        ? {
            ...battle.player,
            body: enemy.body,
            hair: id === 0 ? ('Hair2' as const) : ('Hair3' as const),
            armor: enemy.id === 'boss' ? ('armor' as const) : ('robe' as const),
            weapon: 'sword' as const,
          }
        : battle.player;
      const node = new GameHero(state);
      node.scale.set(enemy?.id === 'boss' ? 3.3 : battle.enemies.length > 1 ? 2.6 : 3);
      node.faceDirection(enemy ? -1 : 1);
      const position = enemy?.position ?? battle.playerPosition;
      node.position.set(310 + (position - 10) * 90, 455 + (typeof id === 'number' ? id * 72 : 0));
      const ring = new Graphics(),
        progress = new Graphics(),
        name = text(enemy?.name ?? battle.player.name, 18);
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
      });
    }
    this.effects = new BattleEffects((id) => this.fighters.get(id)?.node);
    this.root.addChild(this.effects);
    this.sync();
    this.place(0, true);
  }
  private sync(): void {
    const b = this.battle!;
    for (const [id, f] of this.fighters) {
      const body = id === 'player' ? b.player.body : b.enemies[id].body;
      const key = JSON.stringify(body);
      if (key !== f.body) {
        const enemy = id === 'player' ? null : b.enemies[id];
        f.node.setState(
          enemy
            ? {
                ...b.player,
                body,
                hair: id === 0 ? 'Hair2' : 'Hair3',
                armor: enemy.id === 'boss' ? 'armor' : 'robe',
                weapon: 'sword',
              }
            : b.player,
        );
        f.body = key;
      }
      f.node.visible = id === 'player' || b.enemies[id].hp > 0;
      f.ring.visible = f.node.visible;
      f.progress.visible = f.node.visible;
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
      f.node.setMoving(!striking && this.elapsed < f.movingUntil);
      const target = 310 + (position - 10) * 90;
      const k = snap ? 1 : 1 - Math.exp(-18 * dt);
      f.node.x += (target - f.node.x) * k;
      f.node.y = 455 + (typeof id === 'number' ? id * 72 : 0);
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
        f.ring.ellipse(f.node.x, f.node.y + 5, 49, 15).stroke({ color: 0xe7c780, width: 2 });
      }
      if (striking) {
        f.ring
          .ellipse(f.node.x, f.node.y + 5, 56, 18)
          .stroke({ color: enemy ? 0xf08a76 : 0x95e2cb, width: 3 });
      }
      if (id === 'player' && b.defending) {
        f.ring
          .ellipse(f.node.x, f.node.y - 85, 57, 96)
          .stroke({ color: 0x83d5ed, width: 2, alpha: 0.55 });
      }
      f.name.position.set(f.node.x, f.node.y + 25);
      const progress = enemy ? enemy.hp / enemy.stats.maxHp : b.player.hp / b.stats.maxHp;
      f.progress
        .clear()
        .roundRect(f.node.x - 42, f.node.y + 49, 84, 4, 2)
        .fill(0x1b322b)
        .roundRect(
          f.node.x - 42,
          f.node.y + 49,
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
        this.fighters.get(e.source)?.node.playAttack();
      }
      if (e.kind === 'damage' && e.target !== undefined) {
        const target = this.fighters.get(e.target);
        if (target) {
          target.hit = 0.2;
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
    this.place(dt);
    for (const f of this.fighters.values()) {
      f.node.update(dt);
    }
    this.effects.update(dt);
  }
}
