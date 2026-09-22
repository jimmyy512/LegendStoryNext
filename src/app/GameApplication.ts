import { ENCOUNTERS, ITEMS, QUESTS } from '../data/content';
import { MAPS } from '../data/maps';
import { type Battle, type BattleAction } from '../game/battle';
import { BODY_PARTS, PART_NAMES, PART_CAPACITY, type BodyPart } from '../game/body';
import { GameSession } from '../game/GameSession';
import { decodeSave, encodeSave, type SaveSlot } from '../game/save';
import { createGame } from '../game/state';
import { getDialogue, isEntityVisible, type Dialogue } from '../game/story';
import type { GameState, ItemId, MapEntity, Route } from '../game/types';
import { World } from '../render/world';
import {
  action as makeAction,
  heading,
  paragraph,
  type GamePanel,
  type PanelRow,
} from '../ui/canvas/model';
import { creationPanel, dialoguePanel, endingPanel, medicinePanel } from '../ui/canvas/storyPanels';

import { TransitionController } from '../core/TransitionController';
import { AssetService } from '../services/AssetService';
import { AudioService } from '../services/AudioService';
import { SaveRepository } from '../services/SaveRepository';
import type { SettingsRepository } from '../services/SettingsRepository';
import { guardGameGestures } from '../ui/BrowserGestures';
import { GameView } from '../ui/GameView';
import type { LoadingScreen } from '../ui/LoadingScreen';
import { injuryRows, PanelView, type Panel } from '../ui/PanelView';

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
  private view: GameView;
  private panels = new PanelView();
  private dialogue: Dialogue | null = null;
  private dialogueIndex = 0;
  private panel: Panel | null = null;
  private draft: { name: string; route: Route } = { name: '無名', route: 'sword' };
  private pendingImport: GameState | null = null;
  private notice = '點擊地面移動，或點選附近地點前往互動。';
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private readonly saves: SaveRepository,
    private readonly assets: AssetService,
    private readonly loading: LoadingScreen,
    private readonly settings: SettingsRepository,
  ) {
    this.audio.setVolume(settings.readVolume());
    this.audio.setActive(document.visibilityState === 'visible');
    this.transitions = new TransitionController(loading);
    document.documentElement.classList.add('game-active');
    document.body.classList.add('game-active');
    document.querySelector('#app')!.innerHTML =
      '<div id="canvas-host"></div><input type="file" accept=".json,application/json" id="import-file" hidden />';
    guardGameGestures(document.querySelector<HTMLElement>('#app')!, this.lifetime.signal);
    this.view = new GameView(this.world.ui, (action) => this.dispatch(action));
    this.world.onResize = (width, height) => this.view.resize(width, height);
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
    this.world.onBlocked = () => this.toast('那裡無法通行，請點選道路或附近地點。');
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
    this.loading.attach(this.view.loading);
    await this.start(createGame('無名', 'sword'), true);
  }

  dispose(): void {
    this.lifetime.abort();
    document.documentElement.classList.remove('game-active');
    document.body.classList.remove('game-active');
    this.audio.dispose();
    window.clearInterval(this.playTimer);
    this.view.dispose();
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
    this.world.setEnabled(!!this.state && !this.view.modalVisible && !this.battle);
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
    if (!this.state || this.transitions.busy || this.battle || this.view.modalVisible) {
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
    this.openModal(dialoguePanel(this.dialogue!, this.dialogueIndex));
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
        battle &&
        !battle.paused &&
        !this.view.modalVisible &&
        document.visibilityState === 'visible',
      ),
    );
    if (!battle || this.view.modalVisible || document.visibilityState !== 'visible') {
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
    const panelContent = this.panels.render(this.state, panel, {
      saveSlots: panel === 'save' ? this.saveSlots() : [],
      reducedMotion: this.reducedMotion,
      audioVolume: this.audio.volume,
    });
    this.openModal(panelContent);
  }

  private saveSlots(): PanelRow[] {
    return (['manual', 'auto'] as const).flatMap((slot) => this.saveSlot(slot));
  }

  private saveSlot(slot: SaveSlot): PanelRow[] {
    const title = slot === 'manual' ? '手動存檔' : '自動存檔';
    try {
      const record = this.saves.readSave(slot);
      if (!record) {
        return [heading(title), paragraph('尚無存檔')];
      }
      return [
        heading(title),
        paragraph(`${record.state.name} · 第 ${record.state.level} 重
${MAPS[record.state.map].name} · ${QUESTS[record.state.quest].title}
${new Date(record.savedAt).toLocaleString('zh-TW')}`),
        makeAction('讀取這份進度', `load:${slot}`),
      ];
    } catch (error) {
      console.error('Cannot read save slot', slot, error);
      return [heading(title), paragraph('無法讀取，可匯入備份或讀取另一份存檔。')];
    }
  }

  private showEnding(): void {
    if (this.state) {
      this.openModal(endingPanel(this.state));
    }
  }

  private openModal(panel: GamePanel): void {
    this.world.setEnabled(false);
    this.view.openPanel(panel);
  }

  private closeModal(resume = true): void {
    this.view.closePanel();
    this.dialogue = null;
    this.dialogueEntity = null;
    this.panel = null;
    if (resume && this.state && !this.battle) {
      this.world.setEnabled(true);
    }
  }

  private dispatch(action: string): void {
    // 全螢幕和檔案選擇必須保留在使用者手勢呼叫鏈內。
    if (action === 'fullscreen') {
      void this.toggleFullscreen();
      return;
    }
    void this.audio.unlock().then(() => this.audio.play('ui'));
    void this.handle(action).catch((error: unknown) =>
      this.toast(error instanceof Error ? error.message : '操作失敗。'),
    );
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        this.toast('目前已填滿遊戲可用區域，這個瀏覽器未提供全螢幕切換。');
      }
    } catch (error) {
      console.error('Fullscreen request failed', error);
      this.toast('瀏覽器未允許全螢幕，目前維持滿版遊戲。');
    }
  }

  private async handle(action: string): Promise<void> {
    if (this.transitions.busy) {
      return;
    }
    if (await this.handleCanvasAction(action)) {
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
      this.draft = { name: '無名', route: 'sword' };
      this.openModal(creationPanel(this.draft));
      return;
    }
    if (action === 'create') {
      await this.start(createGame(this.draft.name, this.draft.route));
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
      this.openModal({
        title: '讀取旅程',
        rows: [...this.saveSlots(), makeAction('匯入備份', 'import')],
      });
      return;
    }
    if (action.startsWith('load:')) {
      const slot = action.slice(5) as SaveSlot;
      if (this.state) {
        this.openModal({
          title: '讀取這份進度？',
          rows: [
            paragraph('目前未儲存的進度會被取代。'),
            makeAction('確定讀取', `confirm-load:${slot}`),
            makeAction('取消', 'panel:save'),
          ],
        });
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
    if (action.startsWith('entity:') && !this.view.modalVisible && !this.battle) {
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
      this.openModal(medicinePanel(this.battle));
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

  private async handleCanvasAction(action: string): Promise<boolean> {
    if (action.startsWith('route:')) {
      this.draft.route = action === 'route:fist' ? 'fist' : 'sword';
      this.openModal(creationPanel(this.draft));
    } else if (action === 'game-menu') {
      this.openModal({
        title: '江湖選單',
        rows: [
          makeAction('存檔與讀檔', 'panel:save'),
          makeAction('旅途設定', 'panel:settings'),
          makeAction('儲存並返回主選單', 'menu-confirm'),
        ],
      });
    } else if (action === 'nearby' && this.state) {
      this.showNearby();
    } else if (action.startsWith('travel:') && this.state) {
      this.closeModal();
      await this.handle(`entity:${action.slice(7)}`);
    } else if (action === 'confirm-import' && this.pendingImport) {
      const state = this.pendingImport;
      this.pendingImport = null;
      if (await this.start(state)) {
        this.toast('備份已匯入。');
      }
    } else {
      return this.handleBattlePanel(action);
    }
    return true;
  }

  private showNearby(): void {
    const state = this.state!;
    this.openModal({
      title: `${MAPS[state.map].name} · 附近`,
      rows: MAPS[state.map].entities
        .filter((entity) => isEntityVisible(state, entity))
        .map((entity) =>
          makeAction(
            `${entity.name} · ${{ npc: '交談', enemy: '戰鬥', portal: '前往', chest: '查看', herb: '採集', clue: '調查' }[entity.kind]}`,
            `travel:${entity.id}`,
          ),
        ),
    });
  }

  private handleBattlePanel(action: string): boolean {
    const battle = this.battle;
    if (!battle) {
      return false;
    }
    if (action === 'battle-targets') {
      this.openModal({
        title: '選擇敵人',
        rows: battle.enemies.map((enemy, index) => ({
          ...makeAction(
            `${enemy.name} · 生命 ${enemy.hp}/${enemy.stats.maxHp}\n${battle.intent(index)}`,
            `pick-target:${index}`,
          ),
          disabled: enemy.hp <= 0,
        })),
      });
    } else if (action === 'battle-parts') {
      const body = battle.enemies[this.selectedTarget].body;
      this.openModal({
        title: '選擇攻擊部位',
        rows: BODY_PARTS.map((part) => ({
          ...makeAction(
            `${PART_NAMES[part]} ${body[part]}/${PART_CAPACITY[part]}`,
            `pick-body:${part}`,
          ),
          selected: battle.targetPart === part,
        })),
      });
    } else if (action === 'injuries') {
      this.openModal({ title: '我的傷勢', rows: injuryRows(battle.player) });
    } else if (action.startsWith('pick-target:') || action.startsWith('pick-body:')) {
      this.closeModal(false);
      if (action.startsWith('pick-target:')) {
        this.selectTarget(Number(action.slice(12)));
      } else {
        battle.targetPart = action.slice(10) as BodyPart;
        this.renderBattle();
      }
    } else {
      return false;
    }
    return true;
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
      this.pendingImport = record.state;
      this.openModal({
        title: '匯入旅程備份？',
        rows: [
          paragraph(summary),
          paragraph('確認後將接續這份旅程，並更新自動存檔。手動存檔會保留。'),
          makeAction('確定匯入', 'confirm-import'),
          makeAction('取消', 'close'),
        ],
      });
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
    this.view.toast(message);
  }

  private keydown(event: KeyboardEvent): void {
    if (event.code === 'Space' && this.battle && !this.view.modalVisible) {
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      this.battle.togglePause();
      this.renderBattle();
      return;
    }
    if (this.transitions.busy || !this.view.modalVisible) {
      return;
    }
    if (event.key === 'Escape' && !this.dialogue) {
      this.closeModal();
      return;
    }
  }
}
