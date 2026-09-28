import { Container, Graphics } from 'pixi.js';
import { QUESTS } from '../data/content';
import { MAPS } from '../data/maps';
import type { Battle } from '../game/battle';
import { getStats } from '../game/state';
import type { GameState } from '../game/types';
import type { GamePanel } from './canvas/model';
import { BattleHud } from './canvas/BattleHud';
import { CanvasLoading } from './canvas/CanvasLoading';
import { PanelOverlay } from './canvas/PanelOverlay';
import { clear, control, healthBar, label, surface } from './canvas/widgets';

type Screen =
  | { kind: 'home' }
  | { kind: 'explore'; state: GameState; notice: string }
  | { kind: 'battle'; battle: Battle; target: number };

/** 場景上方的 Pixi HUD，不再保留桌面網頁的三欄版面。 */
export class GameView {
  readonly loading: CanvasLoading;
  private hud = new Container();
  private messages = new Container();
  private panels: PanelOverlay;
  private screen: Screen = { kind: 'home' };
  private hero: GameState | null = null;
  private width = 0;
  private height = 0;
  private battleHud: BattleHud | null = null;
  private toastTimer = 0;
  constructor(
    private readonly root: Container,
    private readonly press: (action: string) => void,
  ) {
    this.panels = new PanelOverlay(press);
    root.addChild(this.hud, this.panels.root, this.messages);
    this.loading = new CanvasLoading(root);
  }

  get modalVisible(): boolean {
    return this.panels.visible;
  }
  openPanel(panel: GamePanel): void {
    this.hud.accessibleChildren = false;
    this.panels.show(panel);
  }
  closePanel(): void {
    this.panels.hide();
    this.hud.accessibleChildren = true;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.draw();
    this.panels.resize(width, height);
    this.loading.resize(width, height);
    clear(this.messages);
  }

  renderHome(): void {
    this.screen = { kind: 'home' };
    this.draw();
  }
  renderHud(source: GameState): void {
    this.hero = source;
  }
  renderExploration(state: GameState, notice: string): void {
    this.screen = { kind: 'explore', state, notice };
    this.draw();
  }
  renderBattle(battle: Battle, target: number): void {
    const same = this.screen.kind === 'battle' && this.screen.battle === battle && this.battleHud;
    this.screen = { kind: 'battle', battle, target };
    if (same) {
      this.battleHud!.update(battle);
    } else {
      this.draw();
    }
  }

  private draw(): void {
    clear(this.hud);
    this.battleHud = null;
    if (!this.width) {
      return;
    }
    if (this.screen.kind === 'home') {
      this.home();
      return;
    }
    if (this.screen.kind === 'battle') {
      this.battleHud = new BattleHud(this.screen.battle, this.width, this.height, this.press);
      this.hud.addChild(this.battleHud);
      return;
    }
    this.playerStatus();
    this.placeName();
    if (this.screen.kind === 'explore') {
      this.exploration();
    }
  }

  private button(options: {
    label: string;
    action: string;
    x: number;
    y: number;
    width?: number;
    disabled?: boolean;
    height?: number;
  }): void {
    const button = control({ ...options, width: options.width ?? 64, press: this.press });
    button.position.set(options.x, options.y);
    this.hud.addChild(button);
  }

  private home(): void {
    const shade = new Graphics()
      .rect(0, 0, this.width, this.height)
      .fill({ color: 0x10251f, alpha: 0.35 });
    this.hud.addChild(shade);
    const title = label('口袋江湖', { size: this.height < 340 ? 36 : 48 });
    title.anchor.set(0.5);
    title.position.set(this.width / 2, this.height / 2 - 60);
    this.hud.addChild(title);
    const subtitle = label('初入全真 · 第一回', { size: 15 });
    subtitle.anchor.set(0.5);
    subtitle.position.set(this.width / 2, this.height / 2 - 18);
    this.hud.addChild(subtitle);
    ['踏入江湖', '繼續旅程', '讀取存檔'].forEach((title, index) =>
      this.button({
        label: title,
        action: ['new', 'continue', 'load-menu'][index],
        width: 96,
        x: this.width / 2 - 152 + index * 104,
        y: this.height / 2 + 20,
      }),
    );
    this.button({ label: '全螢幕', action: 'fullscreen', x: this.width - 76, y: 10 });
    this.caption('點擊地面移動 · 點選人物互動', this.height - 30);
  }

  private playerStatus(): void {
    if (!this.hero) {
      return;
    }
    const state = this.hero;
    const stats = getStats(state);
    const card = new Container();
    card.position.set(10, 10);
    card.addChild(surface(176, 76));
    const name = label(`${state.name} · 第 ${state.level} 重`, { size: 13, width: 160 });
    name.position.set(8, 3);
    card.addChild(name);
    const hp = label(`生命 ${state.hp}/${stats.maxHp}    氣 ${state.mp}`, { size: 11 });
    hp.position.set(8, 27);
    card.addChild(hp);
    const life = healthBar({ width: 160, value: state.hp, max: stats.maxHp, color: 0x9abc85 });
    const energy = healthBar({ width: 160, value: state.mp, max: stats.maxMp, color: 0x8bb9c7 });
    life.position.set(8, 50);
    energy.position.set(8, 63);
    card.addChild(life, energy);
    this.hud.addChild(card);
  }

  private placeName(): void {
    const title =
      this.screen.kind === 'explore'
        ? MAPS[this.screen.state.map].name
        : this.screen.kind === 'battle'
          ? this.screen.battle.encounter.name
          : '';
    if (this.width > 600) {
      const heading = label(title, { size: 20 });
      heading.anchor.set(0.5, 0);
      heading.position.set(this.width / 2, 13);
      this.hud.addChild(heading);
    }
    this.button({ label: '全螢幕', action: 'fullscreen', x: this.width - 76, y: 10 });
  }

  private exploration(): void {
    if (this.screen.kind !== 'explore') {
      return;
    }
    const quest = QUESTS[this.screen.state.quest];
    this.button({
      label: quest.title,
      action: 'panel:journal',
      width: 138,
      x: this.width - 150,
      y: 64,
    });
    const entries = [
      ['附近', 'nearby'],
      ['角色', 'panel:character'],
      ['行囊', 'panel:bag'],
      ['任務', 'panel:journal'],
      ['選單', 'game-menu'],
    ];
    const top = this.commandRow(entries);
    this.caption(this.screen.notice, top - 29);
  }

  private commandRow(entries: string[][]): number {
    const columns = this.width < 480 && entries.length > 5 ? 3 : entries.length;
    const width = Math.min(96, (this.width - 28) / columns - 6);
    const start = this.width - 10 - columns * (width + 6) + 6;
    const top = this.height - 8 - Math.ceil(entries.length / columns) * 52;
    entries.forEach(([title, action], index) =>
      this.button({
        label: title,
        action,
        width,
        height: 46,
        x: start + (index % columns) * (width + 6),
        y: top + Math.floor(index / columns) * 52,
      }),
    );
    return top;
  }

  private caption(message: string, y: number): void {
    const text = label(message, { size: 12, width: this.width - 48 });
    const backdrop = surface(Math.min(this.width - 24, text.width + 20), text.height + 8);
    const container = new Container();
    container.position.set((this.width - backdrop.width) / 2, y - Math.max(0, text.height - 18));
    text.position.set(10, 3);
    container.addChild(backdrop, text);
    this.hud.addChild(container);
  }

  updateBattleClock(battle: Battle): void {
    this.battleHud?.update(battle);
  }

  toast(message: string): void {
    clear(this.messages);
    const text = label(message, { size: 14, width: Math.min(440, this.width - 60) });
    this.messages.addChild(surface(text.width + 24, text.height + 20));
    text.position.set(12, 10);
    this.messages.addChild(text);
    this.messages.position.set(
      (this.width - text.width - 24) / 2,
      Math.max(10, this.height / 2 - text.height),
    );
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => clear(this.messages), 4200);
  }

  dispose(): void {
    window.clearTimeout(this.toastTimer);
    clear(this.root);
  }
}
