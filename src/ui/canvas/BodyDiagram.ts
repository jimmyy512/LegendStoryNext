import { Container, Graphics } from 'pixi.js';
import {
  BODY_PARTS,
  PART_CAPACITY,
  PART_NAMES,
  type BodyPart,
  type BodyState,
} from '../../game/body';
import { accessibleLabel, label } from './widgets';

/** 部位顏色只讀取傷勢；金框只表示攻擊目標，不覆蓋健康顏色。 */
export class BodyDiagram extends Container {
  private parts = new Map<BodyPart, Graphics>();
  private previous = '';
  constructor(private readonly select: (part: BodyPart) => void) {
    super();
    const shapes: Record<BodyPart, number[]> = {
      head: [27, 0, 22, 22],
      chest: [22, 26, 32, 28],
      abdomen: [25, 58, 26, 19],
      rightArm: [5, 28, 13, 49],
      leftArm: [58, 28, 13, 49],
      rightLeg: [23, 81, 13, 44],
      leftLeg: [40, 81, 13, 44],
    };
    for (const part of BODY_PARTS) {
      const g = new Graphics();
      const [x, y, w, h] = shapes[part];
      g.position.set(x, y);
      g.label = `${w},${h}`;
      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.accessible = true;
      g.accessibleTitle = PART_NAMES[part];
      g.on('pointertap', (e) => {
        e.stopPropagation();
        this.select(part);
      });
      this.parts.set(part, g);
      this.addChild(g);
    }
    const legend = label('紅：受傷  黑：損毀', { size: 10 });
    legend.anchor.set(0.5, 0);
    legend.position.set(38, 131);
    this.addChild(legend);
  }
  update(body: BodyState, selected?: BodyPart): void {
    const signature = `${BODY_PARTS.map((p) => body[p]).join(',')}:${selected}`;
    if (signature === this.previous) {
      return;
    }
    this.previous = signature;
    for (const [part, g] of this.parts) {
      const [w, h] = g.label.split(',').map(Number);
      const damaged = body[part] < PART_CAPACITY[part];
      const color = body[part] <= 0 ? 0x050708 : damaged ? 0xd24d4a : 0xb1c1b1;
      g.clear()
        .roundRect(0, 0, w, h, 4)
        .fill(color)
        .stroke({
          color: selected === part ? 0xffd27f : 0x68847a,
          width: selected === part ? 2.5 : 1,
        });
      if (body[part] <= 0) {
        g.moveTo(3, 5)
          .lineTo(w - 3, h - 5)
          .moveTo(w - 3, 5)
          .lineTo(3, h - 5)
          .stroke({ color: 0xb1a3a0, width: 1 });
      }
      accessibleLabel(
        g,
        `${PART_NAMES[part]} ${body[part]}/${PART_CAPACITY[part]} ${body[part] <= 0 ? '損毀' : damaged ? '受傷' : '完好'}`,
      );
    }
  }
}
