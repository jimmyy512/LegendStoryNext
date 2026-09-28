import { Container, Graphics, Text } from 'pixi.js';
import { SKILLS } from '../data/content';
import type { BattleEvent } from '../game/battle';
import { text } from './art';

type Actor = number | 'player';
type Effect = {
  node: Container;
  drawing?: Graphics;
  title?: Text;
  age: number;
  duration: number;
  event: BattleEvent;
  source: Actor;
  target: Actor;
};
/** 特效跟隨交戰者；傷害只由規則層決定，視覺不會補算命中。 */
export class BattleEffects extends Container {
  private active: Effect[] = [];
  constructor(private readonly actor: (id: Actor) => Container | undefined) {
    super();
    this.eventMode = 'none';
  }
  show(event: BattleEvent): void {
    if (!event.kind || event.kind === 'injury' || event.source === undefined) {
      return;
    }
    const source = event.source,
      target = event.target ?? source;
    const node = new Container();
    const drawing = new Graphics();
    node.addChild(drawing);
    const skill = Object.values(SKILLS)
      .flat()
      .find((s) => s.id === event.skill);
    const words =
      event.kind === 'windup'
        ? (skill?.name ?? (event.heavy ? '重擊蓄力' : ''))
        : event.kind === 'miss'
          ? '落空'
          : event.kind === 'guard'
            ? (skill?.name ?? '防守')
            : event.kind === 'heal'
              ? '回復'
              : event.amount
                ? `${skill ? `${skill.name}\n` : ''}−${event.amount}`
                : '';
    let title: Text | undefined;
    if (words) {
      title = text(
        words,
        event.kind === 'damage' && !skill ? 30 : 22,
        event.source === 'player' ? 0xffe4a0 : 0xffa28d,
      );
      title.anchor.set(0.5);
      node.addChild(title);
    }
    const duration =
      event.kind === 'windup'
        ? event.heavy
          ? 1
          : event.skill
            ? 0.7
            : 0.45
        : event.kind === 'guard'
          ? 1.2
          : event.kind === 'damage'
            ? event.skill
              ? 1.15
              : 0.85
            : 1;
    this.addChild(node);
    this.active.push({ node, drawing, title, age: 0, duration, event, source, target });
  }
  update(dt: number): void {
    for (const fx of this.active) {
      fx.age += dt;
      const p = Math.min(1, fx.age / fx.duration),
        g = fx.drawing!,
        e = fx.event;
      const source = this.actor(fx.source),
        target = this.actor(fx.target);
      if (!source || !target) {
        fx.age = fx.duration;
        continue;
      }
      const sx = source.x,
        sy = source.y - 90,
        tx = target.x,
        ty = target.y - 90;
      const color =
        e.source === 'player'
          ? e.skill === 'dragon'
            ? 0xffc65e
            : e.skill === 'pierce'
              ? 0x79e6d0
              : 0xc5e9ff
          : 0xf1836f;
      g.clear();
      if (e.kind === 'windup') {
        const r = 40 + p * 22;
        g.ellipse(sx, source.y + 3, r, r * 0.25).stroke({
          color,
          width: 2 + p * 3,
          alpha: 0.3 + p * 0.7,
        });
        if (e.heavy) {
          g.moveTo(sx, sy)
            .lineTo(tx, ty)
            .stroke({ color, width: 3, alpha: 0.15 + p * 0.5 });
        }
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 - p * 2;
          g.circle(sx + Math.cos(a) * r, sy + Math.sin(a) * r, 2 + p * 2).fill({
            color,
            alpha: 0.8,
          });
        }
      } else if (e.kind === 'damage') {
        const fade = Math.max(0, 1 - p * (e.skill ? 1.1 : 1.6)),
          reach = Math.min(1, p * 5);
        if (e.style === 'fist' && !e.skill) {
          g.moveTo(sx, sy)
            .lineTo(tx, ty)
            .stroke({ color: 0xf5d9a0, width: 4, alpha: fade * 0.45 });
          g.circle(tx, ty, 15 + p * 38).stroke({ color: 0xffe6ad, width: 4, alpha: fade });
        } else if (e.skill === 'dragon') {
          // 金色掌勁從掌心推進，命中處擴散同心氣環。
          const x = sx + (tx - sx) * reach,
            y = sy + (ty - sy) * reach;
          g.moveTo(sx, sy)
            .quadraticCurveTo((sx + x) / 2, sy - 35, x, y)
            .stroke({ color, width: 16 * (1 - p), alpha: fade * 0.4 });
          for (let i = 0; i < 3; i++) {
            g.ellipse(x, y, 22 + i * 16 + p * 40, 34 + i * 16 + p * 40).stroke({
              color,
              width: 3,
              alpha: fade * (1 - i * 0.2),
            });
          }
          g.roundRect(x - 10, y - 22, 20, 38, 9).fill({ color: 0xfff0b5, alpha: fade * 0.8 });
        } else if (e.skill === 'pierce') {
          g.moveTo(sx, sy)
            .lineTo(sx + (tx - sx) * reach, ty)
            .stroke({ color, width: 9 * (1 - p), alpha: fade * 0.35 })
            .moveTo(sx, sy)
            .lineTo(tx, ty)
            .stroke({ color: 0xe2fff5, width: 2, alpha: fade });
          for (let i = 0; i < 3; i++) {
            g.moveTo(tx - 25 + i * 18, ty - 35)
              .lineTo(tx + 10 + i * 18, ty + 28)
              .stroke({ color, width: 3, alpha: fade });
          }
        } else {
          const radius = e.skill === 'swordfall' ? 100 : 58;
          g.moveTo(sx, sy + 15)
            .quadraticCurveTo((sx + tx) / 2, Math.min(sy, ty) - radius, tx + 28, ty + 25)
            .stroke({ color, width: e.skill ? 12 : 5, alpha: fade * 0.65 });
          g.moveTo(tx - radius * 0.6, ty + radius * 0.55)
            .quadraticCurveTo(tx + radius, ty - 10, tx + radius * 0.3, ty - radius)
            .stroke({ color: 0xfff6d8, width: e.skill ? 6 : 3, alpha: fade });
        }
        for (let i = 0; i < 9; i++) {
          const a = i * 2.4,
            r = 12 + p * (e.skill ? 135 : 75);
          g.moveTo(tx + Math.cos(a) * r, ty + Math.sin(a) * r)
            .lineTo(tx + Math.cos(a) * (r + 12), ty + Math.sin(a) * (r + 12))
            .stroke({ color, width: 2, alpha: fade });
        }
      } else if (e.kind === 'guard' || e.kind === 'heal') {
        const guard = e.kind === 'guard',
          c = guard ? 0x83d5ed : 0x9ae6ab;
        for (let i = 0; i < 2; i++) {
          g.ellipse(sx, sy, 48 + p * 15 + i * 9, 80 + p * 12 + i * 10).stroke({
            color: c,
            width: guard ? 3 : 2,
            alpha: (1 - p) * (0.8 - i * 0.2),
          });
        }
      }
      if (fx.title) {
        const hit = e.kind === 'damage' || e.kind === 'miss';
        fx.title.position.set(hit ? tx : sx, (hit ? ty : sy) - 105 - (hit ? p * 35 : 0));
        fx.title.alpha = Math.min(1, (1 - p) * 4);
      }
      if (fx.age >= fx.duration) {
        fx.node.destroy({ children: true });
      }
    }
    this.active = this.active.filter((f) => f.age < f.duration);
  }
}
