import { Application, Container, type Ticker } from 'pixi.js';
import { SceneManager } from '../core/SceneManager';
import type { Battle, BattleEvent } from '../game/battle';
import type { GameState, MapEntity, Point } from '../game/types';
import { battleDockHeight } from '../ui/canvas/BattleHud';
import { HEIGHT, WIDTH } from './art';
import { cameraFrame } from './camera';
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
  readonly ui = new Container();
  onResize: (width: number, height: number) => void = () => {};
  private sceneRoot = new Container();
  private observer: ResizeObserver | null = null;
  private host: HTMLElement | null = null;
  private scenes = new SceneManager<PixiScene>();
  private exploration: ExplorationScene | null = null;
  private battle: BattleScene | null = null;
  private tick = (ticker: Ticker): void => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    this.onUpdate(dt);
    this.scenes.update(dt);
    this.updateCamera();
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
    this.host = host;
    this.app.stage.addChild(this.sceneRoot, this.ui);
    host.appendChild(this.app.canvas);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.app.ticker.add(this.tick);
  }

  showMap(state: GameState): void {
    const scene = new ExplorationScene(state);
    scene.onInteract = (entity) => this.onInteract(entity);
    scene.onStep = (point) => this.onStep(point);
    scene.onBlocked = () => this.onBlocked();
    this.scenes.replace(() => {
      scene.mount(this.sceneRoot);
      return scene;
    });
    this.exploration = scene;
    this.battle = null;
    this.app.canvas.setAttribute('aria-label', '江湖探索地圖，點擊地面移動，也可使用附近地點選單');
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
        scene.mount(this.sceneRoot);
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

  private resize(): void {
    if (!this.host) {
      return;
    }
    const { width, height } = this.host.getBoundingClientRect();
    this.app.renderer.resize(Math.max(1, width), Math.max(1, height));
    const safe = getComputedStyle(this.host);
    const left = parseFloat(safe.paddingLeft) || 0;
    const top = parseFloat(safe.paddingTop) || 0;
    const right = parseFloat(safe.paddingRight) || 0;
    const bottom = parseFloat(safe.paddingBottom) || 0;
    this.ui.position.set(left, top);
    this.onResize(width - left - right, height - top - bottom);
    this.updateCamera();
  }

  private updateCamera(): void {
    if (this.battle) {
      const bounds = this.battle.cameraBounds;
      const top = this.app.screen.height < 520 ? 106 : this.app.screen.width < 620 ? 158 : 185;
      const stageHeight = Math.max(
        100,
        this.app.screen.height -
          top -
          battleDockHeight(this.app.screen.width, this.app.screen.height),
      );
      const scale = Math.min(
        (this.app.screen.width - 32) / bounds.width,
        stageHeight / (310 + (bounds.width - 440) * 0.2),
      );
      const weight = 0.12;
      this.sceneRoot.scale.set(this.sceneRoot.scale.x + (scale - this.sceneRoot.scale.x) * weight);
      const actual = this.sceneRoot.scale.x;
      const x = this.app.screen.width / 2 - bounds.x * actual;
      const y = top + stageHeight * 0.5 - bounds.y * actual;
      this.sceneRoot.position.set(
        this.sceneRoot.x + (x - this.sceneRoot.x) * weight,
        this.sceneRoot.y + (y - this.sceneRoot.y) * weight,
      );
      return;
    }
    const focus = this.exploration?.cameraFocus ?? { x: WIDTH / 2, y: HEIGHT * 0.6 };
    const frame = cameraFrame({
      viewport: this.app.screen,
      scene: { width: WIDTH, height: HEIGHT },
      focus,
    });
    this.sceneRoot.scale.set(frame.scale);
    this.sceneRoot.position.set(frame.x, frame.y);
  }

  dispose(): void {
    this.observer?.disconnect();
    this.app.ticker.remove(this.tick);
    this.scenes.dispose();
    this.app.destroy(true, { children: true });
  }
}
