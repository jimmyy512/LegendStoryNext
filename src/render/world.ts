import { Application, type Ticker } from 'pixi.js';
import { SceneManager } from '../core/SceneManager';
import type { Battle, BattleEvent } from '../game/battle';
import type { GameState, MapEntity, Point } from '../game/types';
import { HEIGHT, WIDTH } from './art';
import { BattleScene } from './scenes/BattleScene';
import { ExplorationScene } from './scenes/ExplorationScene';
import type { PixiScene } from './scenes/PixiScene';

/** 引擎入口只管理畫布與場景生命週期，不保存任務或戰鬥規則。 */
export class World {
  onUpdate: (seconds: number) => void = () => {};
  onInteract: (entity: MapEntity) => void = () => {};
  onStep: (point: Point) => void = () => {};
  onTarget: (index: number) => void = () => {};
  onBlocked: () => void = () => {};
  private app = new Application();
  private scenes = new SceneManager<PixiScene>();
  private exploration: ExplorationScene | null = null;
  private battle: BattleScene | null = null;
  private tick = (ticker: Ticker): void => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    this.onUpdate(dt);
    this.scenes.update(dt);
  };

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      width: WIDTH,
      height: HEIGHT,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      background: 0x344c40,
    });
    host.appendChild(this.app.canvas);
    this.app.ticker.add(this.tick);
  }

  showMap(state: GameState): void {
    const scene = new ExplorationScene(state);
    scene.onInteract = (entity) => this.onInteract(entity);
    scene.onStep = (point) => this.onStep(point);
    scene.onBlocked = () => this.onBlocked();
    this.scenes.replace(() => {
      scene.mount(this.app.stage);
      return scene;
    });
    this.exploration = scene;
    this.battle = null;
    this.app.canvas.setAttribute('aria-label', '江湖探索地圖，點擊地面移動，也可使用右側地點列表');
  }

  setEnabled(enabled: boolean): void {
    this.exploration?.setEnabled(enabled);
  }

  setHeroState(state: GameState): void {
    this.exploration?.setHeroState(state);
  }

  navigate(entity: MapEntity): void {
    this.exploration?.navigate(entity);
  }

  showBattle(battle: Battle, selected: number): void {
    if (!this.battle) {
      const scene = new BattleScene();
      scene.onTarget = (index) => this.onTarget(index);
      scene.showBattle(battle, selected);
      this.scenes.replace(() => {
        scene.mount(this.app.stage);
        return scene;
      });
      this.battle = scene;
      this.exploration = null;
    } else {
      this.battle.showBattle(battle, selected);
    }
    this.app.canvas.setAttribute('aria-label', '半即時戰鬥畫面，選擇敵人與部位後使用下方指令');
  }

  showEvents(events: BattleEvent[]): void {
    this.battle?.showEvents(events);
  }

  setBattleRunning(running: boolean): void {
    this.battle?.setRunning(running);
  }

  dispose(): void {
    this.app.ticker.remove(this.tick);
    this.scenes.dispose();
    this.app.destroy(true, { children: true });
  }
}
