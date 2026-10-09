import { Assets, Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { ENCOUNTERS } from '../../data/content';
import { MAPS, TILE } from '../../data/maps';
import { movementRate } from '../../game/body';
import { entityPresentation } from '../../game/entityPresentation';
import { findPath, isWalkable } from '../../game/pathfinding';
import { isEntityVisible } from '../../game/story';
import type { GameState, MapDefinition, MapEntity, Point } from '../../game/types';
import { addAtmosphere, HEIGHT, text, WIDTH } from '../art';
import { PixelBattleHero } from '../PixelBattleHero';
import { PixelWorldActor } from '../PixelWorldActor';
import { PortalMarker } from '../PortalMarker';
import { placeWorldLabel, type WorldLabelBox } from '../worldLabelLayout';
import { PixiScene } from './PixiScene';

/** 玩家走進這個距離內，NPC 會轉身看向玩家。 */
const NPC_NOTICE_TILES = 2.5;

export class ExplorationScene extends PixiScene {
  onInteract: (entity: MapEntity) => void = () => {};
  onStep: (point: Point) => void = () => {};
  onBlocked: () => void = () => {};
  private actors: Container;
  private readonly worldActors: PixelWorldActor[] = [];
  private readonly actorByEntity = new Map<string, PixelWorldActor>();
  private talkingTo: PixelWorldActor | null = null;
  private readonly nameplates = new Container();
  private readonly labelBoxes: WorldLabelBox[] = [];
  private readonly portals: { node: PortalMarker; entity: MapEntity }[] = [];
  private objectiveMarker = new Container();
  private objectiveEntity: MapEntity | null = null;
  private dialogueActive = false;
  private hero: PixelBattleHero;
  private marker: Sprite;
  private state: GameState;
  private position: Point;
  private path: Point[] = [];
  private pending: MapEntity | null = null;
  private enabled = false;
  private drawnEntities = new Set<string>();
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
    for (const entity of MAPS[state.map].entities) {
      if (isEntityVisible(state, entity)) {
        this.drawEntity(entity, state);
      }
    }
    this.root.addChild(this.nameplates);
    const pointer = new Graphics()
      .poly([-10, -12, 10, -12, 0, 0])
      .fill(0xffd879)
      .stroke({ color: 0x142b27, width: 2 });
    const tracked = text('任務目標', 13, 0xffe4a0);
    tracked.anchor.set(0.5, 1);
    tracked.y = -16;
    this.objectiveMarker.addChild(pointer, tracked);
    this.objectiveMarker.visible = false;
    this.objectiveMarker.eventMode = 'none';
    this.root.addChild(this.objectiveMarker);
    this.marker = new Sprite(Assets.get('waypoint'));
    this.marker.anchor.set(0.5);
    this.marker.visible = false;
    this.root.addChild(this.marker);
    this.hero = new PixelBattleHero(state);
    this.hero.scale.set(0.5);
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
  setDialogueActive(active: boolean): void {
    this.dialogueActive = active;
    if (!active) {
      this.talkingTo = null;
    }
    this.nameplates.visible = !active;
    this.objectiveMarker.visible = !active && !!this.objectiveEntity;
  }

  navigate(entity: MapEntity): void {
    if (!this.enabled || !this.state) {
      return;
    }
    this.walkTo(entity, entity);
  }

  setHeroState(state: GameState): boolean {
    this.state = state;
    this.hero.setState(state);
    let added = false;
    for (const entity of MAPS[state.map].entities) {
      if (!this.drawnEntities.has(entity.id) && isEntityVisible(state, entity)) {
        this.drawEntity(entity, state);
        added = true;
      }
    }
    return added;
  }

  setObjective(entity: MapEntity | null): void {
    this.objectiveEntity = entity;
    this.objectiveMarker.visible = !!entity && !this.dialogueActive;
    if (entity) {
      const lift = entity.kind === 'portal' ? 152 : 88;
      this.objectiveMarker.position.set((entity.x + 0.5) * TILE, (entity.y + 0.7) * TILE - lift);
    }
  }

  private drawTerrain(map: MapDefinition): void {
    const terrain = new Sprite(Assets.get(`explore:${map.id}`));
    terrain.texture.source.scaleMode = 'nearest';
    terrain.width = WIDTH;
    terrain.height = HEIGHT;
    terrain.eventMode = 'static';
    terrain.cursor = 'crosshair';
    terrain.on('pointertap', (event) => {
      if (!this.enabled) {
        return;
      }
      const position = event.getLocalPosition(this.root);
      this.walkTo({ x: Math.floor(position.x / TILE), y: Math.floor(position.y / TILE) });
    });
    this.root.addChild(terrain);
  }

  private drawEntity(entity: MapEntity, state: GameState): void {
    this.drawnEntities.add(entity.id);
    const node = new Container();
    node.position.set((entity.x + 0.5) * TILE, (entity.y + 0.7) * TILE);
    node.zIndex = node.y;
    if (entity.kind === 'enemy' && entity.encounter) {
      const id = ENCOUNTERS[entity.encounter].enemies[0];
      const actor = new PixelWorldActor(
        'enemy',
        id,
        id === 'boss' ? 0.065 : 0.05,
        entity.id === 'boss' && state.defeated.includes('boss'),
      );
      this.worldActors.push(actor);
      node.addChild(actor);
    } else if (entity.kind === 'npc') {
      const actor =
        entity.id === 'wounded'
          ? new PixelWorldActor('enemy', 'bandit', 0.05, !state.flags.includes('mercy'))
          : new PixelWorldActor('npc', entity.id, 0.052);
      this.worldActors.push(actor);
      this.actorByEntity.set(entity.id, actor);
      node.addChild(actor);
    } else {
      const g = new Graphics();
      if (entity.kind === 'portal') {
        const portal = new PortalMarker(entity.x > 12 ? 1 : -1);
        node.addChild(portal);
        node.hitArea = new Rectangle(-42, -86, 84, 122);
        this.portals.push({ node: portal, entity });
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
      if (
        entity.art ||
        entity.kind === 'chest' ||
        entity.id === 'wine' ||
        entity.id === 'flower' ||
        entity.id === 'journal'
      ) {
        g.visible = false;
        const opened = entity.kind === 'chest' && state.opened.includes(entity.id);
        const icon = entity.kind === 'chest' ? (opened ? 'chest-open' : 'chest') : entity.id;
        const prop = new Sprite(Assets.get(entity.art ?? `item-icon:${icon}`));
        prop.anchor.set(0.5, 1);
        prop.width = opened
          ? 64
          : entity.kind === 'chest' || entity.id === 'journal' || entity.id === 'flower'
            ? 48
            : 33;
        prop.height = opened
          ? 64
          : entity.kind === 'chest' || entity.id === 'journal'
            ? 43
            : entity.id === 'flower'
              ? 48
              : 35;
        prop.y = opened ? 3 : 0;
        node.addChild(prop);
        node.hitArea = new Rectangle(-32, -64, 64, 97);
      }
    }
    const presentation = entityPresentation(state, entity);
    const label = text(
      entity.kind === 'portal' ? `前往${entity.name}` : presentation.name,
      entity.kind === 'portal' ? 17 : 14,
      presentation.spent ? 0xa7b3a4 : entity.kind === 'enemy' ? 0xf0c4a6 : 0xf2e6c9,
    );
    label.anchor.set(0.5);
    const box = placeWorldLabel(
      {
        x: Math.max(6, Math.min(WIDTH - label.width - 24, node.x - label.width / 2 - 9)),
        // 出口名稱緊接石碑上方，也避免南側出口被手機操作列蓋住。
        y: entity.kind === 'portal' ? node.y - 132 : node.y + 16,
        width: label.width + 18,
        height: entity.kind === 'portal' ? 45 : 23,
      },
      this.labelBoxes,
    );
    this.labelBoxes.push(box);
    const nameplate = new Container();
    nameplate.position.set(box.x, box.y);
    label.position.set(box.width / 2, box.height / 2);
    const plate = new Graphics()
      .roundRect(0, 0, box.width, box.height, 5)
      .fill({ color: 0x152d28, alpha: 0.8 });
    nameplate.addChild(plate, label);
    if (entity.kind === 'portal') {
      plate
        .clear()
        .roundRect(0, 0, box.width, box.height, 4)
        .fill(0x142b27)
        .stroke({ color: 0xe8c983, width: 2 });
      label.y = 14;
      const hint = text('地圖出口 · 點選前往', 10, 0xe8c983);
      hint.anchor.set(0.5);
      hint.position.set(box.width / 2, 34);
      nameplate.addChild(hint);
      nameplate.accessible = true;
      nameplate.accessibleTitle = `地圖出口：前往${entity.name}`;
    }
    nameplate.eventMode = 'static';
    nameplate.cursor = 'pointer';
    nameplate.hitArea = new Rectangle(0, 0, box.width, box.height);
    nameplate.on('pointertap', (event) => {
      event.stopPropagation();
      this.navigate(entity);
    });
    this.nameplates.addChild(nameplate);
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.on('pointertap', (event) => {
      event.stopPropagation();
      this.navigate(entity);
    });
    this.actors.addChild(node);
  }

  /** 抵達人物身旁：人物轉向玩家並打招呼，再交給對話流程。 */
  private arrive(entity: MapEntity): void {
    const actor = this.actorByEntity.get(entity.id);
    if (actor?.kind === 'npc') {
      this.talkingTo = actor;
      actor.playGesture();
    }
    this.onInteract(entity);
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
      this.arrive(pending);
    }
  }

  update(dt: number): void {
    for (const portal of this.portals) {
      portal.node.update(
        dt,
        Math.hypot(this.position.x - portal.entity.x, this.position.y - portal.entity.y) < 3,
      );
    }
    for (const actor of this.worldActors) {
      if (actor.kind === 'npc' && actor.parent) {
        const dx = this.hero.x - actor.parent.x;
        const near = Math.hypot(dx, this.hero.y - actor.parent.y) < TILE * NPC_NOTICE_TILES;
        actor.lookAt(near || actor === this.talkingTo ? dx : null);
      }
      actor.update(dt);
    }
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
          this.arrive(entity);
        }
      }
    } else {
      this.hero.x += (dx / distance) * step;
      this.hero.y += (dy / distance) * step;
    }
    this.hero.zIndex = this.hero.y;
  }
}
