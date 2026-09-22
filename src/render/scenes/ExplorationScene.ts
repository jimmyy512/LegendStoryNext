import { Assets, Container, Graphics, Sprite } from 'pixi.js';
import { MAPS, TILE } from '../../data/maps';
import { movementRate } from '../../game/body';
import { findPath, isWalkable } from '../../game/pathfinding';
import { isEntityVisible } from '../../game/story';
import type { GameState, MapDefinition, MapEntity, Point } from '../../game/types';
import { addAtmosphere, building, HEIGHT, noise, person, text, tree, WIDTH } from '../art';
import { GameHero } from '../GameHero';
import { PixiScene } from './PixiScene';

export class ExplorationScene extends PixiScene {
  onInteract: (entity: MapEntity) => void = () => {};
  onStep: (point: Point) => void = () => {};
  onBlocked: () => void = () => {};
  private actors: Container;
  private hero: GameHero;
  private marker: Sprite;
  private state: GameState;
  private position: Point;
  private path: Point[] = [];
  private pending: MapEntity | null = null;
  private enabled = false;
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.path = [];
      this.pending = null;
      this.marker.visible = false;
      if (this.state) {
        this.hero.position.set((this.position.x + 0.5) * TILE, (this.position.y + 0.7) * TILE);
      }
    }
  }

  constructor(state: GameState) {
    super();

    this.state = state;
    this.position = { ...state.position };

    this.drawTerrain(MAPS[state.map]);
    this.actors = new Container();
    this.actors.sortableChildren = true;
    this.root.addChild(this.actors);
    this.drawObstacles(MAPS[state.map]);
    for (const entity of MAPS[state.map].entities) {
      if (isEntityVisible(state, entity)) {
        this.drawEntity(entity, state);
      }
    }
    this.marker = new Sprite(Assets.get('waypoint'));
    this.marker.anchor.set(0.5);
    this.marker.visible = false;
    this.root.addChild(this.marker);
    this.hero = new GameHero(state);
    this.hero.position.set((state.position.x + 0.5) * TILE, (state.position.y + 0.7) * TILE);
    this.hero.zIndex = this.hero.y;
    this.actors.addChild(this.hero);
    const ring = new Graphics()
      .ellipse(0, 5, 20, 9)
      .stroke({ color: 0xe2c68f, alpha: 0.8, width: 1.5 });
    this.hero.addChildAt(ring, 0);
    addAtmosphere(this.root, state.map === 'cave');
  }

  get cameraFocus(): Point {
    return { x: this.hero.x, y: this.hero.y };
  }

  navigate(entity: MapEntity): void {
    if (!this.enabled || !this.state) {
      return;
    }
    this.walkTo(entity, entity);
  }

  setHeroState(state: GameState): void {
    this.state = state;
    this.hero.setState(state);
  }

  private drawTerrain(map: MapDefinition): void {
    const random = noise(map.id.length * 394 + 17);
    const ground = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(map.palette.ground);
    for (let i = 0; i < 500; i++) {
      const x = random() * WIDTH;
      const y = random() * HEIGHT;
      ground
        .ellipse(x, y, 3 + random() * 40, 2 + random() * 15)
        .fill({ color: i % 2 ? map.palette.light : map.palette.dark, alpha: 0.08 });
    }
    ground
      .moveTo(0, HEIGHT * 0.52)
      .bezierCurveTo(250, HEIGHT * 0.47, 660, HEIGHT * 0.63, WIDTH, HEIGHT * 0.5)
      .stroke({ color: map.palette.path, width: map.id === 'temple' ? 92 : 67, alpha: 0.7 });
    ground
      .moveTo(90, 575)
      .bezierCurveTo(310, 510, 520, 365, 1060, 200)
      .stroke({ color: map.palette.path, width: 52, alpha: 0.55 });
    if (map.id === 'temple') {
      ground.roundRect(430, 245, 335, 350, 6).fill({ color: 0xb2ac94, alpha: 0.55 });
      for (let y = 260; y < 590; y += 26) {
        for (let x = 435; x < 750; x += 48) {
          ground
            .rect(x + (y % 52 ? 0 : 12), y, 42, 21)
            .stroke({ color: 0x696f63, alpha: 0.23, width: 1 });
        }
      }
      ground
        .circle(648, 490, 75)
        .stroke({ color: 0xe1d6b2, alpha: 0.22, width: 2 })
        .circle(648, 490, 56)
        .stroke({ color: 0xe1d6b2, alpha: 0.15, width: 1 });
    }
    ground.eventMode = 'static';
    ground.cursor = 'crosshair';
    ground.on('pointertap', (event) => {
      if (!this.enabled) {
        return;
      }
      const position = event.getLocalPosition(this.root);
      this.walkTo({ x: Math.floor(position.x / TILE), y: Math.floor(position.y / TILE) });
    });
    this.root.addChild(ground);
    const texture = new Sprite(Assets.get(`ground:${map.id}`));
    texture.eventMode = 'none';
    this.root.addChild(texture);
    for (let i = 0; i < 80; i++) {
      const x = random() * WIDTH;
      const y = random() * HEIGHT;
      const reed = new Graphics()
        .moveTo(x, y)
        .lineTo(x - 3, y - 7)
        .moveTo(x, y)
        .lineTo(x + 4, y - 9)
        .stroke({ color: map.palette.light, alpha: 0.3, width: 1 });
      this.root.addChild(reed);
    }
  }

  private drawObstacles(map: MapDefinition): void {
    const random = noise(421);
    for (const block of map.blocks) {
      const x = block.x * TILE;
      const y = block.y * TILE;
      const width = block.w * TILE;
      const height = block.h * TILE;
      if (block.kind === 'building') {
        const node = building(x, y, width, height);
        node.zIndex = y + height;
        this.actors.addChild(node);
      } else if (block.kind === 'tree') {
        for (let i = 0; i < block.w + 1; i++) {
          const tx = x + 15 + random() * (width - 30);
          const ty = y + height * 0.5 + random() * height * 0.45;
          const node = tree(tx, ty, 55 + random() * 35, random);
          node.zIndex = ty;
          this.actors.addChild(node);
        }
      } else if (block.kind === 'water') {
        const g = new Graphics()
          .roundRect(x - 6, y - 6, width + 12, height + 12, 33)
          .fill(0x8c9681)
          .roundRect(x, y, width, height, 30)
          .fill(0x477d7c);
        for (let i = 0; i < 12; i++) {
          const wx = x + 14 + random() * (width - 45);
          const wy = y + 14 + random() * (height - 28);
          g.moveTo(wx, wy)
            .lineTo(wx + 17, wy)
            .stroke({ color: 0xc5d5b9, alpha: 0.3, width: 1 });
        }
        g.ellipse(x + 28, y + 50, 12, 6)
          .fill(0x93a982)
          .ellipse(x + 45, y + 75, 13, 7)
          .fill(0x7f9e75);
        this.actors.addChild(g);
      } else {
        const g = new Graphics();
        g.poly([
          x,
          y + 25,
          x + width * 0.3,
          y - 13,
          x + width * 0.8,
          y,
          x + width,
          y + height * 0.6,
          x + width - 15,
          y + height,
          x + 8,
          y + height,
        ]).fill(map.palette.dark);
        g.poly([
          x + 5,
          y + 25,
          x + width * 0.3,
          y - 13,
          x + width * 0.8,
          y,
          x + width * 0.65,
          y + height * 0.7,
          x + 12,
          y + height - 12,
        ]).fill(map.palette.light);
        g.moveTo(x + width * 0.3, y + 12)
          .lineTo(x + width * 0.22, y + height * 0.5)
          .lineTo(x + 25, y + height * 0.6)
          .stroke({ color: map.palette.dark, alpha: 0.5, width: 3 });
        g.zIndex = y + height;
        this.actors.addChild(g);
      }
    }
    for (let i = 0; i < 18; i++) {
      const tx = i * 72;
      const treeNode = tree(tx, 48, 58 + random() * 30, random);
      treeNode.zIndex = 50;
      this.actors.addChild(treeNode);
    }
  }

  private drawEntity(entity: MapEntity, state: GameState): void {
    const node = new Container();
    node.position.set((entity.x + 0.5) * TILE, (entity.y + 0.7) * TILE);
    node.zIndex = node.y;
    if (entity.kind === 'npc' || entity.kind === 'enemy') {
      node.addChild(person(entity.color ?? 0xb69b74));
    } else {
      const g = new Graphics();
      if (entity.kind === 'portal') {
        g.ellipse(0, 0, 22, 11)
          .fill({ color: 0xd9c38b, alpha: 0.22 })
          .stroke({ color: 0xe6d29f, width: 1.5 });
        g.moveTo(-8, -10).lineTo(0, -19).lineTo(8, -10).stroke({ color: 0xf0dda9, width: 2 });
      } else if (entity.kind === 'chest') {
        g.rect(-13, -20, 26, 20)
          .fill(state.opened.includes(entity.id) ? 0x5a5545 : 0x9c7748)
          .stroke({ color: 0xd1b278, width: 1.5 });
        g.rect(-13, -14, 26, 3).fill(0x594732).rect(-3, -15, 6, 7).fill(0xd6b77d);
      } else {
        g.ellipse(0, 0, 15, 5).fill({ color: 0x152f25, alpha: 0.4 });
        g.moveTo(0, -4)
          .lineTo(0, -24)
          .moveTo(0, -8)
          .lineTo(-9, -15)
          .moveTo(0, -13)
          .lineTo(9, -20)
          .stroke({ color: 0xb0c39b, width: 2 });
        g.circle(0, -25, 5).fill(entity.kind === 'clue' ? 0xe5c496 : 0xd2b7a7);
      }
      node.addChild(g);
    }
    const label = text(entity.name, 14, entity.kind === 'enemy' ? 0xf0c4a6 : 0xf2e6c9);
    label.anchor.set(0.5);
    label.position.set(0, 22);
    const plate = new Graphics()
      .roundRect(-label.width / 2 - 9, 11, label.width + 18, 23, 5)
      .fill({ color: 0x152d28, alpha: 0.8 });
    node.addChild(plate, label);
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.on('pointertap', (event) => {
      event.stopPropagation();
      this.navigate(entity);
    });
    this.actors.addChild(node);
  }

  private walkTo(target: Point, entity: MapEntity | null = null): void {
    if (!this.state) {
      return;
    }
    if (movementRate(this.state.body) === 0) {
      this.onBlocked();
      return;
    }
    const map = MAPS[this.state.map];
    let destination = target;
    if (entity) {
      const candidates = [
        { x: entity.x - 1, y: entity.y },
        { x: entity.x + 1, y: entity.y },
        { x: entity.x, y: entity.y + 1 },
        { x: entity.x, y: entity.y - 1 },
      ];
      const paths = candidates
        .filter((point) => isWalkable(map, point))
        .map((point) => ({ point, path: findPath(map, this.position, point) }))
        .filter(
          ({ point, path }) =>
            path.length || (point.x === this.position.x && point.y === this.position.y),
        );
      paths.sort((a, b) => a.path.length - b.path.length);
      if (!paths.length) {
        this.onBlocked();
        return;
      }
      destination = paths[0].point;
    }
    const path = findPath(map, this.position, destination);
    if (!path.length && (destination.x !== this.position.x || destination.y !== this.position.y)) {
      this.onBlocked();
      return;
    }
    this.path = path;
    this.pending = entity;
    this.marker.position.set((destination.x + 0.5) * TILE, (destination.y + 0.6) * TILE);
    this.marker.visible = path.length > 0;
    if (!path.length && this.pending) {
      const pending = this.pending;
      this.pending = null;
      this.onInteract(pending);
    }
  }

  update(dt: number): void {
    this.hero.setMoving(this.enabled && this.path.length > 0);
    this.hero.update(dt);
    if (!this.enabled || !this.path.length || !this.state) {
      return;
    }
    const point = this.path[0];
    const x = (point.x + 0.5) * TILE;
    const y = (point.y + 0.7) * TILE;
    const dx = x - this.hero.x;
    this.hero.faceDirection(dx);
    const dy = y - this.hero.y;
    const distance = Math.hypot(dx, dy);
    const step = dt * 245 * movementRate(this.state.body);
    if (distance <= step) {
      this.hero.position.set(x, y);
      this.position = { ...point };
      this.onStep(point);
      this.path.shift();
      if (!this.path.length) {
        this.marker.visible = false;
        const entity = this.pending;
        this.pending = null;
        if (entity) {
          this.onInteract(entity);
        }
      }
    } else {
      this.hero.x += (dx / distance) * step;
      this.hero.y += (dy / distance) * step;
    }
    this.hero.zIndex = this.hero.y;
  }
}
