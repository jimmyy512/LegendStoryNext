import { Container, Graphics, Rectangle } from 'pixi.js';
import {
  BODY_PARTS,
  PART_CAPACITY,
  PART_NAMES,
  bodyCondition,
  limbPower,
  movementRate,
  type BodyPart,
  type BodyState,
} from '../../game/body';
import { clear, label } from './widgets';

/** 正面人體定位；左右依角色自身，數值直接使用戰鬥部位耐久。 */
export function bodyStatus(body: BodyState, width: number): Container {
  const root = new Container();
  let selected: BodyPart = BODY_PARTS.reduce((lowest, part) =>
    body[part] / PART_CAPACITY[part] < body[lowest] / PART_CAPACITY[lowest] ? part : lowest,
  );
  const color = (part: BodyPart) =>
    body[part] <= 0 ? 0xf1a18b : body[part] < PART_CAPACITY[part] ? 0xe6ba70 : 0x9eb69b;
  const shapes: Record<BodyPart, number[]> = {
    head: [45, 8, 55, 8, 62, 16, 61, 32, 55, 40, 45, 40, 39, 32, 38, 16],
    chest: [39, 43, 61, 43, 72, 50, 67, 83, 33, 83, 28, 50],
    abdomen: [34, 87, 66, 87, 69, 112, 59, 123, 41, 123, 31, 112],
    rightArm: [25, 51, 32, 56, 27, 85, 21, 107, 20, 129, 13, 136, 8, 129, 12, 102, 17, 75],
    leftArm: [75, 51, 68, 56, 73, 85, 79, 107, 80, 129, 87, 136, 92, 129, 88, 102, 83, 75],
    rightLeg: [32, 119, 47, 127, 47, 159, 43, 188, 43, 212, 29, 212, 28, 207, 33, 183, 31, 157],
    leftLeg: [68, 119, 53, 127, 53, 159, 57, 188, 57, 212, 71, 212, 72, 207, 67, 183, 69, 157],
  };
  const draw = () => {
    clear(root);
    const compact = width < 460;
    const cardW = compact ? Math.min(98, (width - 112) / 2) : 140;
    const scale = compact ? 1.1 : 1.22;
    const top = 48;
    const centerX = width / 2;
    const figureX = centerX - 50 * scale;
    const figureY = top + 15;
    const boardH = 330;
    const bg = new Graphics().rect(0, 0, width, boardH).fill(0x10221f);
    for (let y = 44; y < boardH; y += 22) {
      bg.moveTo(12, y)
        .lineTo(width - 12, y)
        .stroke({ color: 0x577364, alpha: 0.12, width: 1 });
    }
    root.addChild(bg);
    const title = label('身體狀況', { size: 18 });
    title.position.set(12, 8);
    root.addChild(title);
    const injured = BODY_PARTS.filter((p) => body[p] < PART_CAPACITY[p]).length;
    const summary = label(injured ? `${injured} 處傷勢` : '各部位完好', {
      size: 12,
      color: injured ? 0xe6ba70 : 0x9eb69b,
    });
    summary.position.set(width - summary.width - 12, 12);
    root.addChild(summary);
    const activate = (part: BodyPart) => {
      selected = part;
      draw();
    };
    const points: Record<BodyPart, [boolean, number, number, number]> = {
      head: [false, 0, 50, 24],
      chest: [true, 0, 42, 62],
      abdomen: [false, 150, 61, 101],
      rightArm: [true, 75, 21, 84],
      leftArm: [false, 75, 81, 84],
      rightLeg: [true, 225, 38, 174],
      leftLeg: [false, 225, 62, 174],
    };
    for (const part of BODY_PARTS) {
      const region = new Graphics()
        .poly(shapes[part])
        .fill({ color: color(part), alpha: selected === part ? 0.9 : 0.42 })
        .stroke({
          color: selected === part ? 0xffdea0 : color(part),
          width: selected === part ? 1.6 : 0.7,
        });
      region.scale.set(scale);
      region.position.set(figureX, figureY);
      region.eventMode = 'static';
      region.cursor = 'pointer';
      region.on('pointertap', () => activate(part));
      root.addChild(region);
      const [left, cy, px, py] = points[part];
      const x = left ? 8 : width - cardW - 8;
      const y = top + cy;
      const line = new Graphics()
        .moveTo(figureX + px * scale, figureY + py * scale)
        .lineTo(left ? x + cardW : x, y + 22)
        .stroke({ color: color(part), width: 1, alpha: 0.4 });
      root.addChild(line);
      const card = new Container();
      card.position.set(x, y);
      card.eventMode = 'static';
      card.cursor = 'pointer';
      card.hitArea = new Rectangle(0, 0, cardW, 62);
      card.accessible = true;
      card.tabIndex = 0;
      card.accessibleTitle = `${PART_NAMES[part]} ${bodyCondition(body, part)} ${body[part]}/${PART_CAPACITY[part]}`;
      card.on('pointertap', () => activate(part));
      card.addChild(
        new Graphics()
          .rect(0, 0, cardW, 62)
          .fill(selected === part ? 0x334338 : 0x182d27)
          .stroke({ color: selected === part ? 0xe6ba70 : 0x466051, width: 1 }),
      );
      const name = label(PART_NAMES[part], { size: 13 });
      name.position.set(7, 4);
      const condition = label(bodyCondition(body, part), { size: 11, color: color(part) });
      condition.position.set(cardW - condition.width - 7, 6);
      const value = label(`${body[part]} / ${PART_CAPACITY[part]}`, {
        size: 12,
        color: color(part),
      });
      value.position.set(7, 25);
      card.addChild(
        name,
        condition,
        value,
        new Graphics()
          .rect(7, 51, cardW - 14, 4)
          .fill(0x080f0d)
          .rect(7, 51, (cardW - 14) * Math.max(0, Math.min(1, body[part] / PART_CAPACITY[part])), 4)
          .fill(color(part)),
      );
      root.addChild(card);
    }
    const detail = label(`${PART_NAMES[selected]} · ${bodyCondition(body, selected)}`, {
      size: 16,
      color: color(selected),
    });
    detail.position.set(0, 344);
    root.addChild(detail);
    const effect = selected.includes('Leg')
      ? movementRate(body) === 0
        ? '四肢都已失能，無法移動；可從傷勢頁求援回山門。'
        : body.leftLeg === 0 && body.rightLeg === 0
          ? '雙腿都已失能，目前只能以手臂爬行。'
          : body[selected] > 0
            ? '此腿仍可活動；耐久歸零後，移動速度會降低。'
            : '此腿已失能，移動速度降低，需雙腿發力的招式威力下降。'
      : selected.includes('Arm')
        ? body.leftArm === 0 && body.rightArm === 0
          ? '雙手都已失能，無法施展需要手部發力的招式。'
          : body[selected] > 0
            ? '此手仍可出招；耐久歸零後，雙手招式威力會下降。'
            : '此手已失能；單手招式可換手，雙手招式威力下降。'
        : '此部位耐久獨立於生命值，不會單獨降低移動速度或招式威力。';
    const desc = label(effect, { width, size: 13 });
    desc.position.set(0, 374);
    root.addChild(desc);
    const rates = label(
      `移動速度 ${Math.round(movementRate(body) * 100)}%  ·  雙手招式 ${Math.round(limbPower(body, { hands: 2, legs: 0 }) * 100)}%`,
      { width, size: 13, color: 0xc9c4a7 },
    );
    rates.position.set(0, desc.y + desc.height + 12);
    root.addChild(rates);
    const care = label('回山門休養可恢復部位耐久。藥品只補生命與內力。', {
      width,
      size: 13,
      color: 0xc9c4a7,
    });
    care.position.set(0, rates.y + rates.height + 12);
    root.addChild(care);
  };
  draw();
  return root;
}
