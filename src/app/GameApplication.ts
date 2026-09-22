import { ENCOUNTERS, ITEMS, QUESTS } from '../data/content';
import { MAPS } from '../data/maps';
import { type Battle, type BattleAction } from '../game/battle';
import { BODY_PARTS, type BodyPart } from '../game/body';
import { GameSession } from '../game/GameSession';
import { decodeSave, encodeSave, type SaveSlot } from '../game/save';
import { createGame } from '../game/state';
import { getDialogue, type Dialogue } from '../game/story';
import type { GameState, ItemId, MapEntity, Route } from '../game/types';
import { World } from '../render/world';
import { dialoguePortrait } from '../ui/dialoguePortrait';
import { button, escapeHtml as esc, meter } from '../ui/html';

import { TransitionController } from '../core/TransitionController';
import { AssetService } from '../services/AssetService';
import { AudioService } from '../services/AudioService';
import { SaveRepository } from '../services/SaveRepository';
import type { SettingsRepository } from '../services/SettingsRepository';
import { GameView } from '../ui/GameView';
import type { LoadingScreen } from '../ui/LoadingScreen';
import { PanelView, type Panel } from '../ui/PanelView';

export class GameApplication {
  private audio = new AudioService();
  private world = new World();
  private transitions: TransitionController;
  private lifetime = new AbortController();
  private playTimer = 0;
  private session = new GameSession();
  private dialogueEntity: MapEntity | null = null;
  private get state(): GameState | null {
    return this.session.state;
  }
  private get battle(): Battle | null {
    return this.session.battle;
  }
  private selectedTarget = 0;
  private modal: HTMLElement;
  private view: GameView;
  private panels = new PanelView();
  private overlay: HTMLElement;
  private dialogue: Dialogue | null = null;
  private dialogueIndex = 0;
  private panel: Panel | null = null;
  private lastFocus: HTMLElement | null = null;
  private toastTimer = 0;
  private notice = '點擊地面移動，或點選右側地點前往互動。';
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private readonly saves: SaveRepository,
    private readonly assets: AssetService,
    loading: LoadingScreen,
    private readonly settings: SettingsRepository,
  ) {
    this.audio.setVolume(settings.readVolume());
    this.audio.setActive(document.visibilityState === 'visible');
    this.transitions = new TransitionController(loading);
    document.querySelector('#app')!.innerHTML = `
      <header class="topbar"><a class="brand" href="#" data-action="menu"><span class="seal">俠</span><span>口袋江湖<small>LEGEND STORY</small></span></a><div class="chapter-header"><span class="chapter-line"></span><span>第一章 · 初入全真</span><span class="chapter-line"></span></div><span class="version">可玩原型 <i>〇一</i></span></header>
      <main class="game-layout"><aside class="left-panel" id="hud"></aside><section class="center-panel"><div class="map-heading" id="map-heading"></div><div class="stage-frame"><div id="canvas-host"></div><div id="stage-overlay"></div><div class="frame-corner tl"></div><div class="frame-corner tr"></div><div class="frame-corner bl"></div><div class="frame-corner br"></div></div><div id="footer"></div></section><aside class="right-panel" id="side"></aside></main>
      <footer class="page-footer"><span>山河遠闊，且行且看。</span><span>單人冒險 · 本機存檔 <span class="dot"></span> PIXI.JS</span></footer>
      <div class="modal-backdrop" id="modal" hidden></div><div id="toast" role="status" aria-live="polite"></div><input type="file" accept=".json,application/json" id="import-file" hidden />`;
    this.modal = document.querySelector('#modal')!;
    this.view = new GameView(
      document.querySelector('#hud')!,
      document.querySelector('#side')!,
      document.querySelector('#footer')!,
      document.querySelector('#stage-overlay')!,
    );
    this.overlay = document.querySelector('#stage-overlay')!;
    document.addEventListener(
      'click',
      (event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
        if (!target || (target as HTMLButtonElement).disabled) {
          return;
        }
        event.preventDefault();
        void this.audio.unlock().then(() => this.audio.play('ui'));
        void this.handle(target.dataset.action!).catch((error: unknown) =>
          this.toast(error instanceof Error ? error.message : '操作失敗。'),
        );
      },
      { signal: this.lifetime.signal },
    );
    document.addEventListener(
      'keydown',
      (event) => {
        void this.audio.unlock();
        this.keydown(event);
      },
      {
        signal: this.lifetime.signal,
      },
    );
    document
      .querySelector('#import-file')!
      .addEventListener('change', (event) => void this.importFile(event), {
        signal: this.lifetime.signal,
      });
    this.world.onStep = (point) => {
      this.session.move(point);
    };
    this.world.onInteract = (entity) => this.interact(entity);
    this.world.onBlocked = () => this.toast('那裡無法通行，請點選道路或右側地點。');
    this.world.onTarget = (index) => this.selectTarget(index);
    this.world.onUpdate = (seconds) => this.updateBattle(seconds);
    this.playTimer = window.setInterval(() => {
      if (this.state && !this.transitions.busy && document.visibilityState === 'visible') {
        this.session.advanceTime();
      }
    }, 1000);
    document.addEventListener(
      'visibilitychange',
      () => {
        this.audio.setActive(document.visibilityState === 'visible');
        if (document.visibilityState === 'hidden' && this.state && !this.battle && !this.dialogue) {
          this.autoSave();
        }
      },
      { signal: this.lifetime.signal },
    );
  }

  async init(): Promise<void> {
    await this.world.init(document.querySelector('#canvas-host')!);
    await this.start(createGame('無名', 'sword'), true);
  }

  dispose(): void {
    this.lifetime.abort();
    this.audio.dispose();
    window.clearInterval(this.playTimer);
    window.clearTimeout(this.toastTimer);
    this.world.dispose();
  }

  private renderHome(): void {
    this.world.setEnabled(false);
    this.view.renderHome();
  }

  private async start(state: GameState, home = false): Promise<boolean> {
    this.world.setEnabled(false);
    const completed = await this.transitions.run({
      label: `正在前往${MAPS[state.map].name}`,
      prepare: (progress) => this.assets.prepare(state.map, progress),
      commit: () => {
        this.world.showMap(state);
        if (home) {
          this.session.end();
        } else {
          this.session.start(state);
        }
        this.closeModal(false);
        this.overlay.innerHTML = '';
        if (home) {
          this.renderHome();
        } else {
          this.notice = MAPS[state.map].description;
          this.renderExploration();
          this.autoSave();
        }
      },
      cancellable: !!this.state,
      afterCommit: async () => {
        try {
          await this.assets.commit(state.map);
        } catch {
          this.toast('舊場景資源未能釋放，重新整理可回收記憶體。');
        }
      },
    });
    this.world.setEnabled(!!this.state && this.modal.hidden && !this.battle);
    return completed;
  }

  private renderExploration(): void {
    if (!this.state) {
      return;
    }
    this.world.setHeroState(this.state);
    this.renderHud();
    this.view.renderExploration(this.state, this.notice);
  }

  private renderHud(): void {
    if (!this.state) {
      return;
    }
    this.view.renderHud(this.battle?.player ?? this.state);
  }

  private interact(entity: MapEntity): void {
    if (!this.state || this.transitions.busy || this.battle || !this.modal.hidden) {
      return;
    }
    if (entity.kind === 'portal') {
      let destination: GameState;
      try {
        destination = this.session.prepareTravel(entity);
      } catch (error) {
        this.toast((error as Error).message);
        return;
      }
      void this.start(destination).catch((error: Error) => this.toast(error.message));
      return;
    }
    this.dialogueEntity = entity;
    this.dialogue = getDialogue(this.state, entity);
    this.dialogueIndex = 0;
    this.renderDialogue();
  }

  private renderDialogue(): void {
    const dialogue = this.dialogue!;
    const last = this.dialogueIndex === dialogue.lines.length - 1;
    const art = dialoguePortrait(this.dialogueEntity!);
    this.openModal(
      `<div class="dialogue-layout"><div class="dialogue-portrait">${art}<span class="portrait-caption">${esc(dialogue.speaker)}</span></div><div class="dialogue-content"><span class="eyebrow">${esc(dialogue.role)}</span><h2>${esc(dialogue.speaker)}</h2><div class="dialogue-line">${esc(dialogue.lines[this.dialogueIndex])}</div><div class="dialogue-progress">${this.dialogueIndex + 1} / ${dialogue.lines.length}</div><div class="dialogue-choices">${last ? dialogue.choices.map((choice) => button(`${esc(choice.label)}${choice.note ? `<small>${esc(choice.note)}</small>` : ''}`, `story:${choice.action}`, 'choice-button')).join('') : button('繼續 <span>→</span>', 'dialogue-next', 'primary')}</div></div></div>`,
      'dialogue-modal',
      false,
    );
  }

  private chooseStory(action: string): void {
    if (
      !this.state ||
      !this.dialogue ||
      !this.dialogueEntity ||
      this.dialogueIndex !== this.dialogue.lines.length - 1 ||
      !this.dialogue.choices.some((choice) => choice.action === action)
    ) {
      return;
    }
    const outcome = this.session.choose(this.dialogueEntity, action);
    this.closeModal(false);
    if (outcome.battle) {
      this.startBattle(outcome.battle);
      return;
    }
    if (outcome.message) {
      this.notice = outcome.message;
      this.toast(outcome.message);
    }
    this.world.showMap(this.state);
    this.world.setEnabled(true);
    this.renderExploration();
    this.autoSave();
    if (outcome.shop) {
      this.showPanel('shop');
    }
    if (outcome.ending) {
      this.showEnding();
    }
  }

  private startBattle(id: string): void {
    if (!this.state || !ENCOUNTERS[id]) {
      return;
    }
    this.autoSave();
    this.world.setEnabled(false);
    this.session.startBattle(id);
    this.selectedTarget = 0;
    this.renderBattle();
  }

  private renderBattle(): void {
    if (!this.battle) {
      return;
    }
    this.renderHud();
    this.world.showBattle(this.battle, this.selectedTarget);
    this.view.renderBattle(this.battle, this.selectedTarget);
  }

  private selectTarget(index: number): void {
    if (
      !this.battle ||
      this.battle.result ||
      !this.battle.enemies[index] ||
      this.battle.enemies[index].hp <= 0
    ) {
      return;
    }
    this.selectedTarget = index;
    this.battle.target = index;
    this.renderBattle();
  }

  private act(action: BattleAction): void {
    if (!this.battle) {
      return;
    }
    const error = this.session.act(action);
    if (error) {
      this.toast(error);
      return;
    }
    this.closeModal(false);
    this.renderBattle();
  }

  private updateBattle(seconds: number): void {
    const battle = this.battle;
    this.world.setBattleRunning(
      Boolean(
        battle && !battle.paused && this.modal.hidden && document.visibilityState === 'visible',
      ),
    );
    if (!battle || !this.modal.hidden || document.visibilityState !== 'visible') {
      return;
    }
    const previousResult = battle.result;
    const events = battle.update(seconds);
    for (const event of events) {
      if (event.kind === 'damage') {
        this.audio.play(event.target === 'player' ? 'hurt' : 'hit');
      } else if (event.kind === 'heal' || event.kind === 'guard') {
        this.audio.play(event.kind);
      }
    }
    if (!previousResult && (battle.result === 'victory' || battle.result === 'defeat')) {
      this.audio.play(battle.result);
    }
    if (events.length) {
      this.selectedTarget =
        battle.enemies[this.selectedTarget]?.hp > 0
          ? this.selectedTarget
          : Math.max(
              0,
              battle.enemies.findIndex((enemy) => enemy.hp > 0),
            );
      this.renderBattle();
      this.world.showEvents(events);
    }
    this.view.updateBattleClock(battle);
  }

  private finishBattle(): void {
    if (!this.state || !this.battle?.result) {
      return;
    }
    this.notice = this.session.finishBattle() ?? this.notice;
    this.overlay.innerHTML = '';
    this.world.showMap(this.state);
    this.world.setEnabled(true);
    this.renderExploration();
    this.autoSave();
    this.toast(this.notice);
  }

  private showPanel(panel: Panel | null): void {
    if (!this.state || this.battle || !panel) {
      return;
    }
    this.panel = panel;
    const html = this.panels.render(this.state, panel, {
      saveSlots: panel === 'save' ? this.saveSlots() : '',
      reducedMotion: this.reducedMotion,
      audioVolume: this.audio.volume,
    });
    this.openModal(html, 'panel-modal');
  }

  private saveSlots(): string {
    return `<div class="save-slots">${(['manual', 'auto'] as const)
      .map((slot) => {
        try {
          const record = this.saves.readSave(slot);
          return `<div class="save-slot"><span class="tiny-label">${slot === 'manual' ? '手動存檔' : '自動存檔'}</span>${record ? `<h3>${esc(record.state.name)} · 第 ${record.state.level} 重</h3><p>${MAPS[record.state.map].name} / ${QUESTS[record.state.quest].title}</p><small>${new Date(record.savedAt).toLocaleString('zh-TW')}</small>${button('讀取這份進度', `load:${slot}`, 'small-button')}` : '<h3>尚無存檔</h3><p>旅程將從這裡留下足跡。</p>'}</div>`;
        } catch {
          return `<div class="save-slot"><h3>${slot === 'manual' ? '手動' : '自動'}存檔無法讀取</h3><p>可匯入有效備份，或讀取另一份存檔。</p></div>`;
        }
      })
      .join('')}</div>`;
  }

  private showEnding(): void {
    if (!this.state) {
      return;
    }
    this.openModal(
      `<div class="ending"><span class="eyebrow">第一章 · 完</span><div class="ending-seal">俠</div><h2>江湖未遠</h2><p>長恨終於走出了那座山洞。<br/>有些往事還要慢慢說，有些錯也還要慢慢償。</p><p>${this.state.flags.includes('mercy') ? '那個受過你幫助的山賊，在山門外留下一束青蘭。' : '山道重新通行，遠處又傳來了商旅的鈴聲。'}</p><div class="ending-stats"><span>第 ${this.state.level} 重</span><span>${this.state.flags.filter((flag) => flag.endsWith('-done')).length} / 2 支線完成</span><span>${Math.max(1, Math.round(this.state.playSeconds / 60))} 分鐘旅途</span></div><p class="panel-footnote">洛陽篇尚未開放。你仍可探索四個區域、完成支線與整理行囊。</p>${button('留在江湖，繼續探索', 'close', 'primary')}${button('匯出旅程備份', 'export')}</div>`,
      'ending-modal',
    );
  }

  private openModal(html: string, className: string, closable = true): void {
    if (this.modal.hidden) {
      this.lastFocus = document.activeElement as HTMLElement;
    }
    this.world.setEnabled(false);
    this.modal.innerHTML = `<section class="modal ${className}" role="dialog" aria-modal="true" aria-label="${className === 'dialogue-modal' ? '人物對話' : '遊戲面板'}" data-closable="${closable}">${html}</section>`;
    this.modal.hidden = false;
    this.modal.querySelector<HTMLElement>('input, button:not([disabled])')?.focus();
  }

  private closeModal(resume = true): void {
    this.modal.hidden = true;
    this.modal.innerHTML = '';
    this.dialogue = null;
    this.dialogueEntity = null;
    this.panel = null;
    if (resume && this.state && !this.battle) {
      this.world.setEnabled(true);
    }
    this.lastFocus?.focus();
  }

  private async handle(action: string): Promise<void> {
    if (this.transitions.busy) {
      return;
    }
    if (action.startsWith('hair:')) {
      if (
        !this.dialogue &&
        this.panel === 'character' &&
        this.session.changeHair(action.slice(5))
      ) {
        this.renderExploration();
        this.showPanel('character');
        this.autoSave();
      }
      return;
    }
    if (action === 'dialogue-next') {
      if (this.dialogue && this.dialogueIndex < this.dialogue.lines.length - 1) {
        this.dialogueIndex++;
        this.renderDialogue();
      }
      return;
    }
    if (action.startsWith('story:')) {
      this.chooseStory(action.slice(6));
      return;
    }
    if (action === 'close') {
      this.closeModal();
      return;
    }
    if (action === 'new') {
      this.openModal(
        `<div class="modal-heading"><div><span class="eyebrow">一段新的江湖路</span><h2>留下你的名號</h2></div>${button('×', 'close', 'close-button')}</div><label class="name-label" for="hero-name">俠客姓名</label><input id="hero-name" maxlength="12" value="無名" autocomplete="off"/><h3 class="section-title">選擇初修武學</h3><div class="route-choices"><label class="route-card"><input type="radio" name="route" value="sword" checked/><span class="route-symbol">劍</span><strong>劍法</strong><p>破甲尋隙，先發制人。<br/>清風破甲 · 落雁一劍</p></label><label class="route-card"><input type="radio" name="route" value="fist"/><span class="route-symbol">掌</span><strong>拳掌</strong><p>護體反擊，穩中求勝。<br/>抱元守一 · 伏龍掌</p></label></div><p class="panel-footnote">開始新旅程會更新自動存檔，手動存檔仍會保留。</p>${button('踏入松風林 →', 'create', 'primary wide')}`,
        'panel-modal',
      );
      return;
    }
    if (action === 'create') {
      const name = document.querySelector<HTMLInputElement>('#hero-name')!.value;
      const route = document.querySelector<HTMLInputElement>('input[name="route"]:checked')!
        .value as Route;
      await this.start(createGame(name, route));
      return;
    }
    if (action === 'continue') {
      try {
        const record = this.saves.newestSave();
        if (record) {
          await this.start(record.state);
        } else {
          this.toast('尚無存檔，先踏入江湖吧。');
        }
      } catch {
        this.toast('無法讀取存檔，請使用讀檔面板匯入備份。');
      }
      return;
    }
    if (action === 'load-menu') {
      this.openModal(
        `<div class="modal-heading"><h2>讀取旅程</h2>${button('×', 'close', 'close-button')}</div>${this.saveSlots()}<div class="save-actions">${button('匯入備份', 'import')}</div>`,
        'panel-modal',
      );
      return;
    }
    if (action.startsWith('load:')) {
      const slot = action.slice(5) as SaveSlot;
      if (this.state) {
        this.openModal(
          `<div class="modal-heading"><h2>讀取這份進度？</h2></div><p>目前未儲存的進度會被取代。</p><div class="save-actions">${button('確定讀取', `confirm-load:${slot}`, 'primary')}${button('取消', 'panel:save')}</div>`,
          'panel-modal',
        );
      } else {
        await this.load(slot);
      }
      return;
    }
    if (action.startsWith('confirm-load:')) {
      await this.load(action.slice(13) as SaveSlot);
      return;
    }
    if (action === 'import') {
      (document.querySelector('#import-file') as HTMLInputElement).click();
      return;
    }
    if (action === 'export' && this.state && !this.battle && !this.dialogue) {
      const blob = new Blob([encodeSave(this.state)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `口袋江湖-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.toast('旅程備份已匯出。');
      return;
    }
    if (action === 'menu' || action === 'menu-confirm') {
      if (this.battle || this.dialogue) {
        this.toast('請先完成目前的戰鬥或對話。');
        return;
      }
      if (this.state) {
        this.autoSave();
      }
      await this.start(createGame('無名', 'sword'), true);
      return;
    }
    if (!this.state) {
      return;
    }
    if (action.startsWith('entity:') && this.modal.hidden && !this.battle) {
      const entity = MAPS[this.state.map].entities.find((entry) => entry.id === action.slice(7));
      if (entity) {
        this.world.navigate(entity);
      }
      return;
    }
    if (action.startsWith('panel:')) {
      this.showPanel(action.slice(6) as Panel);
      return;
    }
    if (action === 'save' && !this.battle && !this.dialogue) {
      try {
        this.saves.writeSave(this.state, 'manual');
        this.showPanel('save');
        this.toast('手動存檔完成。');
      } catch {
        this.toast('無法寫入存檔，請匯出備份。');
      }
      return;
    }
    if (action === 'motion') {
      this.reducedMotion = !this.reducedMotion;
      document.body.classList.toggle('reduce-motion', this.reducedMotion);
      this.showPanel('settings');
      return;
    }
    if (action.startsWith('volume:') && this.panel === 'settings') {
      const volume = Number(action.slice(7));
      if (![0, 0.25, 0.5, 1].includes(volume)) {
        return;
      }
      this.audio.setVolume(volume);
      try {
        this.settings.writeVolume(volume);
      } catch {
        this.toast('音量已套用，但此瀏覽器無法保留設定。');
      }
      void this.audio.unlock().then(() => this.audio.play('heal'));
      this.showPanel('settings');
      return;
    }
    if (action.startsWith('target:')) {
      this.selectTarget(Number(action.slice(7)));
      return;
    }
    if (action === 'battle-end') {
      this.finishBattle();
      return;
    }
    if (action === 'battle:pause' && this.battle) {
      this.battle.togglePause();
      this.renderBattle();
      return;
    }
    if (action === 'battle:cancel' && this.battle) {
      this.battle.cancelAction();
      this.renderBattle();
      return;
    }
    if (action.startsWith('body:') && this.battle) {
      const part = action.slice(5) as BodyPart;
      if (BODY_PARTS.includes(part)) {
        this.battle.targetPart = part;
      }
      this.renderBattle();
      return;
    }
    if (action === 'battle:attack') {
      this.act({ type: 'attack', target: this.selectedTarget });
      return;
    }
    if (action === 'battle:defend') {
      this.act({ type: 'defend' });
      return;
    }
    if (action === 'battle:escape') {
      this.act({ type: 'escape' });
      return;
    }
    if (action.startsWith('battle:skill:')) {
      this.act({ type: 'skill', skill: action.slice(13), target: this.selectedTarget });
      return;
    }
    if (action === 'battle:items' && this.battle) {
      const stats = this.battle.stats;
      this.openModal(
        `<div class="modal-heading"><h2>戰鬥藥品</h2>${button('×', 'close', 'close-button')}</div>${meter('生命', this.battle.player.hp, stats.maxHp)}${meter('內力', this.battle.player.mp, stats.maxMp, 'mp')}<p>使用藥品會消耗本次行動。</p><div class="dialogue-choices">${(['herb', 'tonic', 'elixir'] as const).map((id) => button(`${ITEMS[id].name} ×${this.battle!.player.inventory[id]}<small>${ITEMS[id].description}</small>`, `battle:item:${id}`, 'choice-button', !this.battle!.player.inventory[id])).join('')}</div>`,
        'panel-modal',
      );
      return;
    }
    if (action.startsWith('battle:item:')) {
      this.act({ type: 'item', item: action.slice(12) as ItemId });
      return;
    }
    if (!this.battle && /^(buy|sell|use|equip):/.test(action)) {
      const [verb, id] = action.split(':') as [string, ItemId];
      const success = this.session.changeItem(verb as 'buy' | 'sell' | 'use' | 'equip', id);
      this.toast(
        success
          ? `${ITEMS[id].name}：${{ buy: '購買完成', sell: '出售完成', use: '使用完成', equip: '已裝備' }[verb]}`
          : '目前無法執行，請確認數量、銀兩或是否需要恢復。',
      );
      const panel = this.panel;
      this.renderExploration();
      this.showPanel(panel);
      this.autoSave();
    }
  }

  private async load(slot: SaveSlot): Promise<void> {
    try {
      const record = this.saves.readSave(slot);
      if (!record) {
        throw new Error();
      }
      if (await this.start(record.state)) {
        this.toast('已接續旅程。');
      }
    } catch {
      this.toast('這份存檔無法讀取，請嘗試另一份或匯入備份。');
    }
  }

  private async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.battle || this.dialogue) {
      return;
    }
    try {
      if (file.size > 100000) {
        throw new Error('存檔檔案過大。');
      }
      const record = decodeSave(await file.text());
      const summary = `${record.state.name} · ${MAPS[record.state.map].name} · ${QUESTS[record.state.quest].title}`;
      this.openModal(
        `<div class="modal-heading"><h2>匯入旅程備份？</h2></div><p>${esc(summary)}</p><p>確認後將接續這份旅程，並更新自動存檔。手動存檔會保留。</p><div class="save-actions"><button class="primary" id="confirm-import">確定匯入</button>${button('取消', 'close')}</div>`,
        'panel-modal',
      );
      document.querySelector('#confirm-import')!.addEventListener(
        'click',
        () => {
          void this.start(record.state)
            .then((completed) => {
              if (completed) {
                this.toast('備份已匯入。');
              }
            })
            .catch((error: Error) => this.toast(error.message));
        },
        { once: true },
      );
    } catch (error) {
      this.toast(error instanceof Error ? `匯入失敗：${error.message}` : '無法匯入此檔案。');
    }
  }

  private autoSave(): void {
    if (!this.state || this.battle || this.dialogue) {
      return;
    }
    try {
      this.saves.writeSave(this.state, 'auto');
    } catch {
      this.toast('自動存檔失敗，請從存讀檔面板匯出備份。');
    }
  }

  private toast(message: string): void {
    const toast = document.querySelector<HTMLElement>('#toast')!;
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 4200);
  }

  private keydown(event: KeyboardEvent): void {
    if (event.code === 'Space' && this.battle && this.modal.hidden) {
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      this.battle.togglePause();
      this.renderBattle();
      return;
    }
    if (this.transitions.busy || this.modal.hidden) {
      return;
    }
    if (event.key === 'Escape' && !this.dialogue) {
      this.closeModal();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = [
      ...this.modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href]',
      ),
    ];
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
