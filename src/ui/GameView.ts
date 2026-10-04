import {
  Assets,
  Container,
  FillGradient,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';
import { navigationTexture, type NavigationArt } from '../render/NavigationArt';
import { PixelBattleHero } from '../render/PixelBattleHero';
import { artIcon } from './canvas/CharacterSheet';
import { QUESTS } from '../data/content';
import { MAPS } from '../data/maps';
import type { Battle } from '../game/battle';
import { getStats } from '../game/state';
import { nextObjective, objectiveLabel, type ObjectiveKind } from '../game/objectives';
import type { GameState } from '../game/types';
import type { GamePanel } from './canvas/model';
import { BattleHud } from './canvas/BattleHud';
import { ExplorationMinimap } from './canvas/ExplorationMinimap';
import type { Point } from '../game/types';
import { CanvasLoading } from './canvas/CanvasLoading';
import { PanelOverlay } from './canvas/PanelOverlay';
import { clear, control, drawGamePlate, label, surface } from './canvas/widgets';

type Screen =
  | { kind: 'home' }
  | { kind: 'explore'; state: GameState; notice: string; objective: ObjectiveKind }
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
  private minimap: ExplorationMinimap | null = null;
  private mapExpanded: boolean | null = null;
  updateMapPosition(point: Point): void {
    this.minimap?.setPosition(point);
  }
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
  get dialogueStageHeight(): number {
    return this.panels.dialogueStageHeight;
  }
  openPanel(panel: GamePanel): void {
    this.hud.accessibleChildren = false;
    this.hud.visible = panel.layout !== 'dialogue';
    this.panels.show(panel);
  }
  closePanel(): void {
    this.panels.hide();
    this.hud.visible = true;
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
  renderExploration(state: GameState, notice: string, objective: ObjectiveKind = 'main'): void {
    this.screen = { kind: 'explore', state, notice, objective };
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
    this.minimap = null;
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
    primary?: boolean;
    icon?: NavigationArt;
  }): void {
    const button = control({ ...options, width: options.width ?? 64, press: this.press });
    if (options.icon) {
      const image = new Sprite(navigationTexture(options.icon));
      image.anchor.set(0.5);
      image.scale.set(42 / Math.max(image.texture.width, image.texture.height));
      image.position.set((options.width ?? 64) / 2, 27);
      image.eventMode = 'none';
      button.addChild(image);
      const title = button.children.find((child) => child instanceof Text) as Text;
      title.style.fontSize = 12;
      title.y = (options.height ?? 78) - 14;
    }
    if (options.action === 'fullscreen') {
      const corners = new Graphics();
      for (const [x, y, dx, dy] of [
        [8, 13, 1, 1],
        [22, 13, -1, 1],
        [8, 27, 1, -1],
        [22, 27, -1, -1],
      ]) {
        corners
          .rect(x + (dx < 0 ? -6 : 0), y + (dy < 0 ? -2 : 0), 6, 2)
          .rect(x + (dx < 0 ? -2 : 0), y + (dy < 0 ? -6 : 0), 2, 6);
      }
      corners.fill(0xe6d2a0);
      corners.eventMode = 'none';
      button.addChild(corners);
      const title = button.children.find((child) => child instanceof Text) as Text;
      title.style.fontSize = 10;
      title.x = (options.width ?? 64) - 19;
    }
    button.position.set(options.x, options.y);
    this.hud.addChild(button);
  }

  private home(): void {
    const w = this.width;
    const h = this.height;
    const compact = w < 760;
    this.hud.addChild(new Graphics().rect(0, 0, w, h).fill(0x091916));
    const texture = Assets.get<Texture>('title-scene');
    if (texture) {
      const art = new Sprite(texture);
      art.scale.set(Math.max(w / texture.width, h / texture.height));
      art.position.set(w - art.width, (h - art.height) / 2);
      this.hud.addChild(art);
    }
    // A dedicated title composition covers the live exploration scene completely.
    const ink = new Graphics().rect(0, 0, w, h).fill(
      new FillGradient({
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
        colorStops: [
          { offset: 0, color: 'rgba(8,27,24,0.96)' },
          { offset: 1, color: compact ? 'rgba(8,27,24,0.5)' : 'rgba(8,27,24,0.08)' },
        ],
      }),
    );
    this.hud.addChild(ink);
    const x = compact ? 28 : Math.max(60, w * 0.1);
    const short = h < 550;
    const y = short ? 30 : h * 0.17;
    const title = label('口袋江湖', {
      size: compact ? 52 : 78,
      family: '"Noto Serif TC", "PMingLiU", serif',
    });
    title.position.set(x, y);
    this.hud.addChild(title);
    const seal = new Container();
    seal.addChild(
      new Graphics()
        .rect(0, 0, 30, 36)
        .fill(0x883f32)
        .rect(3, 3, 24, 30)
        .stroke({ color: 0xcda881, width: 1 }),
    );
    const two = label('貳', { size: 20, color: 0xf1d7a2 });
    two.position.set(5, 2);
    seal.addChild(two);
    seal.position.set(x + title.width + 12, y + 20);
    this.hud.addChild(seal);
    const subtitle = label('初入全真', {
      size: 22,
      color: 0xd9c28d,
      family: '"Noto Serif TC", serif',
    });
    subtitle.position.set(x, y + (compact ? 90 : 119));
    this.hud.addChild(subtitle);
    if (!short) {
      const story = label('松風入袖，劍未出鞘。\n從一介無名，走出自己的江湖。', {
        size: 14,
        color: 0xc6c9b5,
        width: 300,
      });
      story.position.set(x, y + (compact ? 135 : 167));
      this.hud.addChild(story);
    }
    const menuY = short ? y + 160 : y + (compact ? 222 : 260);
    const buttonW = Math.min(278, w - 56);
    [
      ['繼續旅程', 'continue'],
      ['開始新旅程', 'new'],
      ['讀取存檔', 'load-menu'],
    ].forEach(([text, action], index) => {
      this.button({
        label: text,
        action,
        width: buttonW,
        height: 48,
        primary: index === 0,
        x,
        y: menuY + index * 60,
      });
    });
    this.button({ label: '全螢幕', action: 'fullscreen', x: w - 90, y: 20, width: 72 });
    const footer = label('第一章 · 初入全真', { size: 12, color: 0xb7bfa8 });
    footer.position.set(x, h - 35);
    this.hud.addChild(footer);
  }

  private playerStatus(): void {
    if (!this.hero) {
      return;
    }
    const state = this.hero;
    const stats = getStats(state);
    const card = new Container();
    card.position.set(10, 10);
    const portrait = new PixelBattleHero(state, { showInjuryTint: false });
    portrait.scale.set(0.72);
    portrait.position.set(42, 41 - portrait.impactPoint('head').y * 0.72);
    const mask = new Graphics().circle(42, 41, 24).fill(0xffffff);
    const portraitGround = new Graphics().circle(42, 41, 24).fill(0x162b24);
    portrait.mask = mask;
    const frame = new Sprite(navigationTexture('status'));
    frame.width = 244;
    frame.height = 89;
    frame.eventMode = 'none';
    card.addChild(frame);
    card.addChild(portraitGround, portrait, mask);
    const name = label(state.name, { size: 15, width: 148, color: 0xf0dfad });
    name.position.set(86, 2);
    const level = label(`第 ${state.level} 重`, { size: 10, color: 0xe8c983 });
    level.anchor.set(0.5, 0);
    level.position.set(42, 78);
    card.addChild(
      new Graphics()
        .roundRect(18, 77, 48, 16, 3)
        .fill(0x172b24)
        .stroke({ color: 0xb19c69, width: 1 }),
    );
    card.addChild(name, level);
    [
      { value: state.hp, max: stats.maxHp, color: 0xa95742, title: '生命', y: 29 },
      { value: state.mp, max: stats.maxMp, color: 0x3c9296, title: '內力', y: 51 },
    ].forEach(({ value, max, color, title, y }) => {
      const amount = Math.max(0, Math.min(1, value / max));
      const bar = new Graphics().roundRect(0, 0, 128, 14, 5).fill(0x0c1b18);
      if (amount > 0) {
        bar.roundRect(1, 1, 126 * amount, 12, 4).fill(color);
        bar.rect(4, 2, Math.max(0, 120 * amount), 2).fill({ color: 0xffe5bc, alpha: 0.25 });
      }
      bar.position.set(88, y);
      const number = label(`${title} ${value}/${max}`, { size: 10, color: 0xfff3d5 });
      number.position.set(94, y - 1);
      card.addChild(bar, number);
    });
    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.hitArea = new Rectangle(0, 0, 244, 94);
    card.accessible = true;
    card.accessibleTitle = `角色狀態，${state.name}，生命 ${state.hp}/${stats.maxHp}，內力 ${state.mp}/${stats.maxMp}`;
    card.on('pointertap', () => this.press('panel:character'));
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
      const heading = label(title, {
        size: 20,
        family: '"Noto Serif TC", "PMingLiU", serif',
      });
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
    const next = nextObjective(this.screen.state, this.screen.objective);
    const mobile = this.width < 620;
    const objectiveWidth = mobile ? this.width - 20 : 330;
    const objectiveX = this.width - objectiveWidth - 10;
    const objectiveY = mobile ? 108 : 62;
    const card = new Container();
    card.position.set(objectiveX, objectiveY);
    card.addChild(drawGamePlate(new Graphics(), 0, 0, objectiveWidth, 102, { active: true }));
    const kindNames = {
      main: '主線',
      herb: '採藥',
      wine: '尋酒',
      rest: '休養',
      training: '練武',
      martial: '武學',
    };
    const heading = label(
      `${kindNames[this.screen.objective]} · ${this.screen.objective === 'main' ? quest.title : '目前追蹤'}`,
      { size: 14, color: 0xe8c983, width: objectiveWidth - 24 },
    );
    heading.position.set(12, 8);
    const task = label(next ? objectiveLabel(next) : '第一章已完成', {
      size: 19,
      width: objectiveWidth - 110,
    });
    task.position.set(12, 34);
    const hint = label(next ? '跟隨場景與小地圖的金色任務標記' : '可查看支線，或回山門整備', {
      size: 11,
      width: objectiveWidth - 24,
      color: 0xc7d3bd,
    });
    hint.position.set(12, 78);
    card.addChild(heading, task, hint);
    this.hud.addChild(card);
    this.button({
      label: next ? '帶我前往' : '查看任務',
      action: next ? `guide:${this.screen.objective}` : 'panel:journal',
      width: 88,
      height: 40,
      primary: true,
      x: objectiveX + objectiveWidth - 100,
      y: objectiveY + 34,
    });
    const expanded = this.mapExpanded ?? !mobile;
    const toggle = control({
      label: expanded ? '收起小地圖' : '展開小地圖',
      action: 'map-toggle',
      width: 116,
      height: 40,
      press: () => {
        this.mapExpanded = !expanded;
        this.draw();
      },
    });
    toggle.position.set(this.width - 126, mobile ? 56 : objectiveY + 112);
    const mapIcon = new Sprite(navigationTexture('map'));
    mapIcon.anchor.set(0.5);
    mapIcon.scale.set(28 / Math.max(mapIcon.texture.width, mapIcon.texture.height));
    mapIcon.position.set(20, 20);
    mapIcon.eventMode = 'none';
    const toggleTitle = toggle.children.find((child) => child instanceof Text) as Text;
    toggleTitle.style.fontSize = 12;
    toggleTitle.x = 76;
    toggle.addChild(mapIcon);
    this.hud.addChild(toggle);
    if (expanded) {
      this.minimap = new ExplorationMinimap(
        this.screen.state,
        next,
        mobile ? 230 : 260,
        this.press,
      );
      this.minimap.position.set(
        this.width - (mobile ? 240 : 270),
        objectiveY + (mobile ? 112 : 158),
      );
      this.hud.addChild(this.minimap);
    }
    const entries = [
      ['附近互動', 'nearby', 'nearby'],
      ['角色', 'panel:character', 'character'],
      ['行囊', 'panel:bag', 'bag'],
      ['任務', 'panel:journal', 'quest'],
      ['選單', 'game-menu', 'menu'],
    ] as const;
    const narrow = this.width < 620;
    const navWidth = Math.min(560, this.width - 20);
    const start = narrow ? (this.width - navWidth) / 2 : this.width - navWidth - 16;
    const top = this.height - 90;
    entries.forEach(([title, action, icon], index) =>
      this.button({
        label: title,
        action,
        icon,
        primary: index === 0,
        width: navWidth / 5 - 5,
        height: 78,
        x: start + (index * navWidth) / 5,
        y: top,
      }),
    );
    this.caption(this.screen.notice, top - 34);
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
    const reward = /獲得|找到.*銀兩|銀兩.*經驗/.test(message);
    const blocked = /無法通行|無法抵達/.test(message);
    const title = reward
      ? '獲得獎勵'
      : blocked
        ? '前路不通'
        : /存檔|備份/.test(message)
          ? '旅途記錄'
          : '江湖消息';
    const maxW = Math.min(420, this.width - 32);
    const text = label(message, { size: 14, width: maxW - 100, color: 0xd7dfcb });
    const h = Math.max(84, text.height + 46);
    this.messages.addChild(drawGamePlate(new Graphics(), 0, 0, maxW, h));
    artIcon(
      this.messages,
      reward ? 'item-icon:chest' : blocked ? 'waypoint' : 'item-icon:journal',
      38,
      h / 2,
      44,
    );
    const heading = label(title, {
      size: 17,
      color: reward ? 0xe8c983 : blocked ? 0xe6ba90 : 0xeee4ca,
    });
    heading.position.set(74, 10);
    text.position.set(74, 38);
    this.messages.addChild(heading, text);
    this.messages.position.set(
      this.width < 640 ? (this.width - maxW) / 2 : this.width - maxW - 24,
      Math.max(220, this.height - h - (this.width < 640 ? 160 : 100)),
    );
    this.messages.eventMode = 'none';
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => clear(this.messages), 4200);
  }

  dispose(): void {
    window.clearTimeout(this.toastTimer);
    clear(this.root);
  }
}
