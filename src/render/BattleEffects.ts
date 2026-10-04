import { Container, Sprite, Text } from 'pixi.js';
import { SKILLS } from '../data/content';
import type { BattleEvent } from '../game/battle';
import type { BodyPart } from '../game/body';
import { text } from './art';
import { skillEffectSprite } from './PixelSkillEffects';

type Actor = number | 'player';
type ImpactActor = Container & { impactPoint?: (part: BodyPart) => { x: number; y: number } };
type Effect = {
  node: Container;
  art?: Sprite;
  title?: Text;
  age: number;
  duration: number;
  event: BattleEvent;
  source: Actor;
  target: Actor;
};

/** 事件只觸發演出；所有傷害、命中與防禦仍由規則層決定。 */
export class BattleEffects extends Container {
  private active: Effect[] = [];

  constructor(private readonly actor: (id: Actor) => ImpactActor | undefined) {
    super();
    this.eventMode = 'none';
  }

  show(event: BattleEvent): void {
    if (!event.kind || event.kind === 'injury' || event.source === undefined) {
      return;
    }
    const source = event.source;
    const target = event.target ?? source;
    const skill = Object.values(SKILLS)
      .flat()
      .find((s) => s.id === event.skill);
    const words =
      event.kind === 'windup'
        ? (skill?.name ?? event.move ?? (event.heavy ? '重擊蓄力' : ''))
        : event.kind === 'miss'
          ? '落空'
          : event.kind === 'guard'
            ? (skill?.name ?? '防守')
            : event.kind === 'heal'
              ? '回復'
              : event.amount
                ? `${skill ? `${skill.name}\n` : ''}−${event.amount}`
                : '';
    const node = new Container();
    let art: Sprite | undefined;
    if (
      event.kind === 'damage' ||
      (event.kind === 'windup' && !!event.skill) ||
      event.kind === 'guard' ||
      event.kind === 'heal'
    ) {
      art = skillEffectSprite(
        event.skill ?? (event.kind === 'guard' || event.kind === 'heal' ? 'guard' : undefined),
      );
      node.addChild(art);
    }
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
          ? 0.8
          : 0.54
        : event.kind === 'damage'
          ? 0.48
          : event.kind === 'guard'
            ? 0.72
            : 0.65;
    this.addChild(node);
    this.active.push({ node, art, title, age: 0, duration, event, source, target });
  }

  update(dt: number): void {
    for (const fx of this.active) {
      fx.age += dt;
      const p = Math.min(1, fx.age / fx.duration);
      const source = this.actor(fx.source);
      const target = this.actor(fx.target);
      if (!source || !target) {
        fx.age = fx.duration;
        continue;
      }
      const hit = fx.event.kind === 'damage' || fx.event.kind === 'miss';
      const anchor = hit ? target : source;
      const { x, y } =
        hit && fx.event.part && target.impactPoint
          ? this.toLocal(target.impactPoint(fx.event.part), target)
          : this.toLocal({ x: anchor.x, y: anchor.y - 95 }, anchor.parent ?? undefined);
      if (fx.art) {
        fx.art.position.set(x, y);
        const windup = fx.event.kind === 'windup';
        const guard = fx.event.kind === 'guard' || fx.event.kind === 'heal';
        const size = windup ? 0.16 : guard ? 0.22 : fx.event.skill ? 0.29 : 0.18;
        const pulse = windup
          ? 0.78 + p * 0.25
          : 0.8 + Math.sin(Math.min(1, p * 1.6) * Math.PI) * 0.24;
        fx.art.scale.set(size * pulse);
        fx.art.alpha = windup
          ? Math.min(0.64, p * 1.6) * (1 - p * 0.5)
          : Math.max(0, 1 - Math.pow(p, 1.65));
        fx.art.rotation = fx.event.kind === 'damage' ? -0.16 + p * 0.13 : 0;
      }
      if (fx.title) {
        // Damage text stays above the actor even when the strike hits a foot.
        const caption = this.toLocal({ x: anchor.x, y: anchor.y - 187 }, anchor.parent ?? undefined);
        fx.title.position.set(caption.x, caption.y - (hit ? p * 32 : 0));
        fx.title.alpha = Math.min(1, (1 - p) * 4);
      }
      if (fx.age >= fx.duration) {
        fx.node.destroy({ children: true });
      }
    }
    this.active = this.active.filter((effect) => effect.age < effect.duration);
  }
}
