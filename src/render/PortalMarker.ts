import { Container, Graphics, Sprite } from 'pixi.js';
import { navigationTexture } from './NavigationArt';

/** A weathered trail milestone belongs to the terrain; the destination remains a clickable label. */
export class PortalMarker extends Container {
  private stone: Sprite;
  constructor(direction: number) {
    super();
    this.addChild(new Graphics().ellipse(3, 2, 25, 7).fill({ color: 0x17251a, alpha: 0.32 }));
    this.stone = new Sprite(navigationTexture('milestone'));
    this.stone.anchor.set(0.5, 1);
    this.stone.scale.set(direction * 0.22, 0.22);
    this.addChild(this.stone);
  }
  update(dt: number, near: boolean): void {
    void dt;
    this.stone.tint = near ? 0xffffff : 0xe0e5d5;
  }
}
