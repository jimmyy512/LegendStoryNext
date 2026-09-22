import { Container } from 'pixi.js';
import type { Scene } from '../../core/SceneManager';

/** 場景只擁有自己的顯示物件，貼圖由資源服務管理，不在場景銷毀時一併刪除。 */
export abstract class PixiScene implements Scene {
  readonly root = new Container();

  mount(host: Container): void {
    host.addChild(this.root);
  }

  abstract update(dt: number): void;

  dispose(): void {
    this.root.destroy({ children: true });
  }

  protected clear(): void {
    for (const child of this.root.removeChildren()) {
      child.destroy({ children: true });
    }
  }
}
