import { AccessibilitySystem, Application, Container, type Ticker } from 'pixi.js';
import { SceneManager } from '../core/SceneManager';
import type { Battle, BattleEvent } from '../game/battle';
import type { GameState, MapEntity, Point } from '../game/types';
import { battleDockHeight } from '../ui/canvas/BattleHud';
import { HEIGHT, WIDTH } from './art';
import { battleCameraY, cameraFrame } from './camera';
import { dialogueCameraFrame } from './dialogueCamera';
import type { DialogueShot } from '../game/chapterOneDialogue';
import { TILE } from '../data/maps';
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
  private dialogueShot: {
    entity: MapEntity;
    shot: DialogueShot;
    stageHeight: () => number;
    reducedMotion: boolean;
  } | null = null;
  private returningFromDialogue = false;
  private tick = (ticker: Ticker): void => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.05);
    this.onUpdate(dt);
    this.scenes.update(dt);
    this.updateCamera();
  };

  async init(host: HTMLElement): Promise<void> {
    AccessibilitySystem.defaultOptions.deactivateOnMouseMove = false;
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
    this.app.renderer.accessibility.setAccessibilityEnabled(true);
    this.app.renderer.accessibility.div.classList.add('game-accessibility-layer');
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.app.ticker.add(this.tick);
  }

  showMap(state: GameState): void {
    this.dialogueShot = null;
    this.returningFromDialogue = false;
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
  setDialogueShot(
    entity: MapEntity,
    shot: DialogueShot,
    stageHeight: () => number,
    reducedMotion: boolean,
  ): void {
    this.dialogueShot = { entity, shot, stageHeight, reducedMotion };
    this.exploration?.setDialogueActive(true);
  }
  endDialogueShot(): void {
    this.returningFromDialogue = !!this.dialogueShot && !this.dialogueShot.reducedMotion;
    this.dialogueShot = null;
    this.exploration?.setDialogueActive(false);
  }

  setHeroState(state: GameState): void {
    this.exploration?.setHeroState(state);
  }

  navigate(entity: MapEntity): void {
    this.exploration?.navigate(entity);
  }

  setObjective(entity: MapEntity | null): void {
    this.exploration?.setObjective(entity);
  }

  showBattle(battle: Battle, selected: number): void {
    const enteringBattle = !this.battle;
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
    if (enteringBattle) {
      this.updateCamera(true);
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
    this.updateCamera(true);
  }

  private updateCamera(snap = false): void {
    if (this.battle) {
      const bounds = this.battle.cameraBounds;
      const top = this.app.screen.height < 520 ? 106 : this.app.screen.width < 620 ? 158 : 185;
      const stageHeight = Math.max(
        100,
        this.app.screen.height -
          top -
          battleDockHeight(this.app.screen.width, this.app.screen.height, this.battle.finished),
      );
      // Desktop framing includes generous side space. On a portrait phone that
      // padding makes both fighters tiny and exposes the top/bottom of the art.
      const portrait = this.app.screen.width < 620 && this.app.screen.height >= 520;
      // Cap close-combat zoom so weapons and leaning poses remain inside the phone viewport.
      const frameWidth = Math.max(
        portrait ? Math.max(480, bounds.width - 320) : bounds.width,
        bounds.poseWidth ?? 0,
      );
      const scale = Math.min(
        (this.app.screen.width - (portrait ? 16 : 32)) / frameWidth,
        stageHeight / (310 + (bounds.width - 440) * 0.2),
      );
      const weight = snap ? 1 : 0.12;
      this.sceneRoot.scale.set(this.sceneRoot.scale.x + (scale - this.sceneRoot.scale.x) * weight);
      const actual = this.sceneRoot.scale.x;
      const art = this.battle.artBounds;
      // The extended arena covers both boundaries; keep the actors, not the art center, in view.
      const x = this.app.screen.width / 2 - bounds.x * actual;
      const y = battleCameraY(top, stageHeight, bounds.y, actual, art);
      this.sceneRoot.position.set(
        this.sceneRoot.x + (x - this.sceneRoot.x) * weight,
        this.sceneRoot.y + (y - this.sceneRoot.y) * weight,
      );
      this.battle.coverBackdrop(
        (top - this.sceneRoot.y) / actual,
        (top + stageHeight - this.sceneRoot.y) / actual,
      );
      return;
    }
    const focus = this.exploration?.cameraFocus ?? { x: WIDTH / 2, y: HEIGHT * 0.6 };
    const dialogue = this.dialogueShot;
    const frame = dialogue
      ? dialogueCameraFrame({
          viewport: this.app.screen,
          scene: { width: WIDTH, height: HEIGHT },
          player: focus,
          subject: { x: (dialogue.entity.x + 0.5) * TILE, y: (dialogue.entity.y + 0.7) * TILE },
          shot: dialogue.shot,
          stageHeight: dialogue.stageHeight(),
        })
      : cameraFrame({
          viewport: this.app.screen,
          scene: { width: WIDTH, height: HEIGHT },
          focus,
        });
    const animated = dialogue || this.returningFromDialogue;
    const weight = snap || dialogue?.reducedMotion || !animated ? 1 : 0.12;
    this.sceneRoot.scale.set(
      this.sceneRoot.scale.x + (frame.scale - this.sceneRoot.scale.x) * weight,
    );
    this.sceneRoot.position.set(
      this.sceneRoot.x + (frame.x - this.sceneRoot.x) * weight,
      this.sceneRoot.y + (frame.y - this.sceneRoot.y) * weight,
    );
    if (!dialogue && Math.abs(this.sceneRoot.scale.x - frame.scale) < 0.001) {
      this.returningFromDialogue = false;
    }
  }

  dispose(): void {
    this.observer?.disconnect();
    this.app.ticker.remove(this.tick);
    this.scenes.dispose();
    this.app.destroy(true, { children: true });
  }
}
