import { ButtonContainer, ProgressBar } from '@pixi/ui';
import { Container, Graphics } from 'pixi.js';
import { MAPS } from '../../data/maps';
import type { Battle, BattleEvent } from '../../game/battle';
import { addAtmosphere, HEIGHT, noise, text, tree, WIDTH } from '../art';
import { CombatantSprite } from '../CombatantSprite';
import { GameHero } from '../GameHero';
import { PixiScene } from './PixiScene';

export class BattleScene extends PixiScene {
  onTarget: (index: number) => void = () => {};
  private effects = new Container();
  private transient: { node: Container; life: number }[] = [];
  private fighters = new Map<number | 'player', Container>();
  private strikes: { node: Container; x: number; direction: number; life: number }[] = [];
  private hero: GameHero | null = null;
  private running = false;

  setRunning(running: boolean): void {
    this.running = running;
  }

  showBattle(battle: Battle, selected: number): void {
    // 指令、目標和傷害都會刷新面板，保留角色才能避免動畫每次從第一幀重播。
    this.hero?.removeFromParent();
    this.clear();
    this.transient = [];
    this.strikes = [];
    this.fighters.clear();

    const map = MAPS[battle.player.map];
    const g = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(map.palette.dark);
    const random = noise(62);
    for (let i = 0; i < 8; i++) {
      const base = 110 + i * 35;
      g.poly([
        0,
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
        WIDTH,
        base,
        WIDTH,
        HEIGHT,
        0,
        HEIGHT,
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
    const hero = this.hero ?? new GameHero(battle.player);
    this.hero = hero;
    hero.setState(battle.player);
    hero.scale.set(3.2);
    hero.position.set(310, 475);
    this.root.addChild(hero);
    this.fighters.set('player', hero);
    const heroName = text(battle.player.name, 24);
    heroName.anchor.set(0.5);
    heroName.position.set(310, 535);
    this.root.addChild(heroName);
    const positions =
      battle.enemies.length === 1
        ? [{ x: 820, y: 455 }]
        : [
            { x: 770, y: 405 },
            { x: 915, y: 510 },
            { x: 950, y: 345 },
          ];
    battle.enemies.forEach((enemy, index) => {
      const position = positions[index];
      const node = new ButtonContainer(new CombatantSprite(enemy.color, enemy.body));
      node.scale.set(enemy.id === 'boss' ? 3.7 : 3);
      node.position.set(position.x, position.y);
      node.alpha = enemy.hp > 0 ? 1 : 0.2;
      node.enabled = enemy.hp > 0;
      node.cursor = enemy.hp > 0 ? 'pointer' : 'default';
      node.onPress.connect(() => {
        if (enemy.hp > 0) {
          this.onTarget(index);
        }
      });
      this.root.addChild(node);
      this.fighters.set(index, node);
      if (selected === index && enemy.hp > 0) {
        this.root.addChild(
          new Graphics()
            .ellipse(position.x, position.y + 12, 55, 18)
            .stroke({ color: 0xe5c68a, width: 2 }),
        );
      }
      const label = text(enemy.hp > 0 ? enemy.name : '已敗退', 20);
      label.anchor.set(0.5);
      label.position.set(position.x, position.y + 47);
      this.root.addChild(label);
      const bar = new ProgressBar({
        bg: new Graphics().roundRect(0, 0, 96, 5, 2).fill(0x26352f),
        fill: new Graphics().roundRect(0, 0, 96, 5, 2).fill(0xcb967b),
        progress: (100 * enemy.hp) / enemy.stats.maxHp,
      });
      bar.position.set(position.x - 48, position.y + 68);
      this.root.addChild(bar);
    });
    this.effects = new Container();
    this.root.addChild(this.effects);
    addAtmosphere(this.root, battle.player.map === 'cave');
  }

  showEvents(events: BattleEvent[]): void {
    for (const event of events) {
      if (event.kind !== 'damage' || event.source === undefined) {
        continue;
      }
      const actor = this.fighters.get(event.source);
      if (event.source === 'player') {
        this.hero?.playAttack();
      }
      if (actor && !this.strikes.some((strike) => strike.node === actor)) {
        this.strikes.push({
          node: actor,
          x: actor.x,
          direction: event.source === 'player' ? 1 : -1,
          life: 0.35,
        });
      }
      const target = event.target === undefined ? undefined : this.fighters.get(event.target);
      if (target) {
        const flash = new Graphics()
          .moveTo(-24, 22)
          .quadraticCurveTo(0, -28, 24, -40)
          .stroke({ color: 0xf2dc9d, width: 4, alpha: 0.8 });
        flash.position.set(target.x, target.y - 75);
        this.effects.addChild(flash);
        this.transient.push({ node: flash, life: 0.3 });
      }
    }
    events
      .filter((event) => event.amount)
      .forEach((event, index) => {
        const label = text(`−${event.amount}`, 34, event.target === 'player' ? 0xe4a58d : 0xf3d49a);
        label.anchor.set(0.5);
        label.position.set(
          event.target === 'player' ? 310 + index * 18 : 780 + (Number(event.target) || 0) * 100,
          285 - index * 24,
        );
        this.effects.addChild(label);
        this.transient.push({ node: label, life: 1.8 });
      });
  }

  update(dt: number): void {
    if (!this.running) {
      return;
    }
    this.hero?.update(dt);
    for (const strike of this.strikes) {
      strike.life = Math.max(0, strike.life - dt);
      strike.node.x =
        strike.x + Math.sin((1 - strike.life / 0.35) * Math.PI) * 22 * strike.direction;
    }
    this.strikes = this.strikes.filter((strike) => strike.life > 0);
    for (const effect of this.transient) {
      effect.life -= dt;
      effect.node.y -= dt * 25;
      effect.node.alpha = Math.min(1, effect.life);
      if (effect.life <= 0) {
        effect.node.destroy();
      }
    }
    this.transient = this.transient.filter((effect) => effect.life > 0);
  }
}
