import { Assets, Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import { COLS, MAPS, ROWS } from '../../data/maps';
import { isEntityVisible } from '../../game/story';
import { isWalkable } from '../../game/pathfinding';
import { entityPresentation } from '../../game/entityPresentation';
import type { GameState, MapEntity, Point } from '../../game/types';
import { label, surface } from './widgets';

/** Uses the same terrain and walk mask as exploration; never a decorative map. */
export class ExplorationMinimap extends Container {
  private player = new Graphics();
  private readonly cell: number;
  constructor(
    state: GameState,
    objective: MapEntity | null,
    width: number,
    press: (action: string) => void,
    showTitle = true,
  ) {
    super();
    this.cell = (width - 20) / COLS;
    const height = this.cell * ROWS;
    const inset = showTitle ? 30 : 8;
    this.addChild(surface(width, height + inset + 33));
    const title = label(MAPS[state.map].name, { size: 14, color: 0xe8c983 });
    title.position.set(10, 5);
    if (showTitle) {
      this.addChild(title);
    }
    const map = new Container();
    map.position.set(10, inset);
    this.addChild(map);
    const art = new Sprite(Assets.get(`explore:${state.map}`));
    art.width = width - 20;
    art.height = height;
    art.alpha = 0.45;
    map.addChild(art);
    const roads = new Graphics();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (isWalkable(MAPS[state.map], { x, y })) {
          roads
            .rect(x * this.cell, y * this.cell, this.cell, this.cell)
            .fill({ color: 0xe0ca91, alpha: 0.35 });
        }
      }
    }
    map.addChild(roads);
    for (const entity of MAPS[state.map].entities.filter((e) => isEntityVisible(state, e))) {
      const tracked = entity.id === objective?.id;
      const exit = entity.kind === 'portal';
      const chance = entity.id.startsWith('chance-');
      const pin = new Container();
      pin.position.set((entity.x + 0.5) * this.cell, (entity.y + 0.5) * this.cell);
      const g = new Graphics();
      if (tracked) {
        g.poly([0, -8, 8, 0, 0, 8, -8, 0]).fill(0xffd879).stroke({ color: 0x1a251e, width: 2 });
      } else if (exit) {
        g.rect(-5, -5, 10, 10).fill(0xe8c983).stroke({ color: 0x182b26, width: 2 });
      } else {
        const hostile = entity.kind === 'enemy' && !state.defeated.includes(entity.encounter!);
        g.circle(0, 0, 2.5).fill(hostile ? 0xe9967e : 0xc7d3bd);
      }
      pin.addChild(g);
      if (exit || tracked || chance) {
        pin.eventMode = 'static';
        pin.cursor = 'pointer';
        pin.hitArea = new Rectangle(-12, -12, 24, 24);
        pin.accessible = true;
        pin.accessibleTitle = `小地圖：${tracked ? '任務目標，' : chance ? '奇遇，' : '出口，'}${entityPresentation(state, entity).name}`;
        pin.on('pointertap', (event) => {
          event.stopPropagation();
          press(`entity:${entity.id}`);
        });
      }
      map.addChild(pin);
    }
    this.player.circle(0, 0, 6).fill(0x102b28).circle(0, 0, 3.5).fill(0xc2fff0);
    this.player.eventMode = 'none';
    map.addChild(this.player);
    this.setPosition(state.position);
    const legend = label('青點：你　金菱：任務　金方：出口', {
      size: 11,
      width: width - 16,
      color: 0xd2d9c4,
    });
    legend.position.set(8, height + inset + 4);
    this.addChild(legend);
  }
  setPosition(point: Point): void {
    this.player.position.set((point.x + 0.5) * this.cell, (point.y + 0.5) * this.cell);
  }
}
