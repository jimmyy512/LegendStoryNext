import { Container, Graphics, Text } from 'pixi.js';
import { COLS, ROWS, TILE } from '../data/maps';

export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;
const font = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';

export function text(value: string, size = 18, color = 0xf0e5c9): Text {
  return new Text({
    text: value,
    style: { fontFamily: font, fontSize: size, fill: color, letterSpacing: 2 },
  });
}

export function noise(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function person(color: number, hero = false): Container {
  const node = new Container();
  const g = new Graphics();
  g.ellipse(0, 5, 16, 7).fill({ color: 0x101e1c, alpha: 0.4 });
  g.moveTo(-8, -11).lineTo(-10, 1).lineTo(-2, 1).lineTo(0, -13).fill(0x26352e);
  g.moveTo(2, -12).lineTo(3, 1).lineTo(11, 1).lineTo(8, -12).fill(0x26352e);
  g.poly([-9, -38, 9, -38, 16, -11, 7, -6, -12, -7]).fill(color);
  g.poly([-8, -37, 0, -24, 8, -37, 3, -11, -3, -11]).fill({ color: 0xded8bd, alpha: 0.85 });
  g.rect(-11, -18, 24, 4).fill(0x7a5745);
  g.poly([-9, -35, -19, -17, -13, -14, -3, -30]).fill(color);
  g.poly([8, -36, 18, -18, 12, -14, 3, -30]).fill(color);
  g.circle(0, -45, 10).fill(0xd4b995);
  g.ellipse(0, -51, 10, 6).fill(0x202f2c);
  g.rect(-10, -49, 20, 4).fill(0x202f2c);
  g.circle(1, -59, 5).fill(0x202f2c);
  if (hero) {
    g.moveTo(-16, -43).lineTo(-10, -9).stroke({ color: 0xd6dacb, width: 3 });
    g.moveTo(-20, -39).lineTo(-10, -41).stroke({ color: 0xcba562, width: 3 });
    g.moveTo(4, -54).lineTo(13, -51).lineTo(18, -39).stroke({ color: 0xb8a36e, width: 2 });
  }
  node.addChild(g);
  return node;
}

export function tree(x: number, y: number, size: number, random: () => number): Container {
  const node = new Container();
  node.position.set(x, y);
  const g = new Graphics();
  g.ellipse(12, 10, size * 0.8, size * 0.3).fill({ color: 0x132720, alpha: 0.3 });
  g.poly([-5, 0, -3, -size, 5, -size, 8, 0]).fill(0x655c43);
  const colors = [0x203e32, 0x2d5140, 0x3b6148, 0x507251];
  for (let i = 0; i < 5; i++) {
    const dx = (random() - 0.5) * size * 0.85;
    const dy = -size * (0.6 + random() * 0.6);
    const radius = size * (0.4 + random() * 0.15);
    g.ellipse(dx + 3, dy + 5, radius, radius * 0.68).fill(colors[0]);
    g.ellipse(dx, dy, radius, radius * 0.6).fill(colors[(i % 3) + 1]);
    g.ellipse(dx - radius * 0.15, dy - 4, radius * 0.6, radius * 0.24).fill({
      color: 0x83916a,
      alpha: 0.12,
    });
  }
  node.addChild(g);
  return node;
}

export function building(x: number, y: number, width: number, height: number): Container {
  const node = new Container();
  node.position.set(x, y);
  const g = new Graphics();
  g.roundRect(10, 10, width + 5, height, 3).fill({ color: 0x172c28, alpha: 0.35 });
  g.rect(4, height * 0.4, width - 8, height * 0.55).fill(0xbdb49a);
  g.rect(0, height - 14, width, 16).fill(0x878d7c);
  g.rect(-8, height, width + 16, 10).fill(0xa7aa93);
  g.rect(width * 0.4, height * 0.52, width * 0.2, height * 0.43).fill(0x394944);
  for (const offset of [0.16, 0.7]) {
    g.rect(width * offset, height * 0.58, width * 0.13, height * 0.22).fill(0x43534a);
    for (let j = 0; j < 4; j++) {
      g.rect(width * offset + j * width * 0.033, height * 0.58, 2, height * 0.22).fill(0x978c69);
    }
  }
  for (const offset of [0.08, 0.34, 0.64, 0.9]) {
    g.rect(width * offset, height * 0.45, 6, height * 0.48).fill(0x765847);
  }
  g.poly([
    -20,
    height * 0.5,
    0,
    height * 0.37,
    width / 2,
    -12,
    width,
    height * 0.37,
    width + 20,
    height * 0.5,
    width / 2,
    height * 0.27,
  ]).fill(0x304d47);
  g.poly([
    -20,
    height * 0.5,
    width / 2,
    height * 0.27,
    width + 20,
    height * 0.5,
    width + 18,
    height * 0.57,
    width / 2,
    height * 0.34,
    -18,
    height * 0.57,
  ]).fill(0x607b6a);
  for (let i = 0; i < 14; i++) {
    const at = i / 13;
    g.moveTo(width / 2 + (at - 0.5) * width * 0.12, 0)
      .lineTo(at * (width + 20) - 10, height * 0.5)
      .stroke({ color: 0x91a18a, width: 1, alpha: 0.25 });
  }
  g.moveTo(width / 2, -14)
    .lineTo(width / 2, height * 0.29)
    .stroke({ color: 0xaaa789, width: 5 });
  g.roundRect(width * 0.33, height * 0.45, width * 0.34, 22, 2)
    .fill(0x253e35)
    .stroke({ color: 0xae9870, width: 1 });
  node.addChild(g);
  const label = text(width > 250 ? '全 真 殿' : '清 修', width > 250 ? 14 : 12);
  label.anchor.set(0.5);
  label.position.set(width * 0.5, height * 0.45 + 11);
  node.addChild(label);
  return node;
}

export function addAtmosphere(root: Container, cave: boolean): void {
  const overlay = new Graphics();
  overlay.rect(0, 0, WIDTH, 32).fill({ color: 0x132b27, alpha: 0.15 });
  overlay.rect(0, HEIGHT - 30, WIDTH, 30).fill({ color: 0x132b27, alpha: 0.13 });
  if (cave) {
    for (const [x, y] of [
      [440, 440],
      [880, 300],
    ]) {
      for (let r = 90; r > 0; r -= 15) {
        overlay.circle(x, y, r).fill({ color: 0xe5b877, alpha: 0.016 });
      }
      overlay
        .rect(x - 3, y - 16, 6, 25)
        .fill(0x786449)
        .ellipse(x, y - 20, 5, 8)
        .fill(0xe8c48a);
    }
  }
  overlay.eventMode = 'none';
  root.addChild(overlay);
}
