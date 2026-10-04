import { Assets, Sprite, Texture } from 'pixi.js';

const SKILL_ART: Record<string, string> = {
  pierce: 'pierce',
  swordfall: 'swordfall',
  dragon: 'dragon',
  guard: 'guard',
};

/** 技能形狀由透明像素美術提供，不以畫線指示攻擊。 */
export function skillEffectSprite(skill?: string): Sprite {
  const id = skill ? SKILL_ART[skill] : undefined;
  const texture = Assets.get<Texture>(`effect:${id ?? 'impact'}`);
  texture.source.scaleMode = 'nearest';
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.eventMode = 'none';
  return sprite;
}
