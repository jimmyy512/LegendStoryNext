import { ENCOUNTERS, ITEMS, QUESTS } from '../data/content';
import { MAPS } from '../data/maps';
import { type Battle, type BattleAction } from '../game/battle';
import { BODY_PARTS, PART_NAMES, PART_CAPACITY, type BodyPart } from '../game/body';
import { GameSession } from '../game/GameSession';
import { opponentName } from '../game/opponentName';
import { entityPresentation } from '../game/entityPresentation';
import { activeObjective, nextObjective, type ObjectiveKind } from '../game/objectives';
import { SparringLesson } from '../game/SparringLesson';
import { nearestWalkable } from '../game/pathfinding';
import { createCombatPreview, prepareCombatPreview } from '../game/combatPreview';
import { decodeSave, encodeSave, type SaveSlot } from '../game/save';
import { createGame } from '../game/state';
import { TALENTS, type TalentId } from '../game/talents';
import { ROUTE_NAMES } from '../game/martialTraining';
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
import {
  combatGuidePanel,
  creationPanel,
  dialoguePanel,
  endingPanel,
  medicinePanel,
  sparringLessonPanel,
  equipmentRewardPanel,
} from '../ui/canvas/storyPanels';

import { TransitionController } from '../core/TransitionController';
import { AssetService } from '../services/AssetService';
import { AudioService } from '../services/AudioService';
import { SaveRepository } from '../services/SaveRepository';
import type { SettingsRepository } from '../services/SettingsRepository';
import { guardGameGestures } from '../ui/BrowserGestures';
import { GameView } from '../ui/GameView';
import type { LoadingScreen } from '../ui/LoadingScreen';
import { PanelView, type Panel } from '../ui/PanelView';

export class GameApplication {
  private guidedObjective: ObjectiveKind = 'main';
  private audio = new AudioService();
  private world = new World();
  private transitions: TransitionController;
  private lifetime = new AbortController();
  private playTimer = 0;
  private combatPreview = false;
  private bossTellPauseUsed = false;
  private session = new GameSession();
  private dialogueEntity: MapEntity | null = null;
  private get state(): GameState | null {
    return this.session.state;
  }
  private get battle(): Battle | null {
    return this.session.battle;
  }
  private selectedTarget = 0;
  private sparringLesson = new SparringLesson();
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
      this.view.updateMapPosition(point);
    };
    this.world.onInteract = (entity) => this.interact(entity);
    this.world.onBlocked = () => this.toast('那裡無法通行，請點選道路或附近地點。');
    this.world.onTarget = (index) => this.selectTarget(index);
    this.world.onUpdate = (seconds) => {
      if (document.visibilityState === 'visible') {
        this.view.updateNotifications(seconds, this.reducedMotion);
      }
      this.updateBattle(seconds);
    };
    this.playTimer = window.setInterval(() => {
      if (this.state && !this.transitions.busy && document.visibilityState === 'visible') {
        this.session.advanceTime();
        if (!this.battle && !this.view.modalVisible) {
          const state = this.state!;
          if (this.world.setHeroState(state)) {
            this.renderExploration();
          }
        }
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

  async init(
    preview?: {
      route: Route;
      encounter: string;
      map: GameState['map'];
      injured?: boolean;
      defeat?: boolean;
      chapterBoss?: boolean;
    },
    worldPreview?: GameState['map'],
    previewCondition?: 'injured' | 'immobile' | 'aftermath',
    previewEquipment = false,
  ): Promise<void> {
    this.combatPreview = !!preview || !!worldPreview;
    await this.world.init(document.querySelector('#canvas-host')!);
    this.loading.attach(this.view.loading);
    if (preview) {
      const state = createCombatPreview(preview.route, preview.chapterBoss);
      if (preview.injured) {
        state.body.rightArm = 0;
      }
      state.map = preview.map;
      await this.start(state);
      if (preview.defeat) {
        this.saves.writeSave(state, 'auto');
      }
      this.startBattle(preview.encounter);
      if (this.battle) {
        if (!preview.chapterBoss) {
          prepareCombatPreview(this.battle);
        }
        if (preview.defeat) {
          this.battle.player.hp = 1;
        }
        this.renderBattle();
      }
    } else if (worldPreview) {
      const state = previewEquipment ? createCombatPreview('sword') : createGame('無名', 'sword');
      state.map = worldPreview;
      if (previewCondition === 'injured' || previewCondition === 'immobile') {
        state.body.head = 33;
        state.body.leftLeg = 0;
        state.body.rightArm = 0;
        state.hp = 64;
        if (previewCondition === 'immobile') {
          state.body.leftArm = 0;
          state.body.rightLeg = 0;
        }
      }
      state.position =
        worldPreview === 'temple'
          ? { x: 3, y: 7 }
          : worldPreview === 'mountain'
            ? { x: 2, y: 4 }
            : worldPreview === 'cave'
              ? { x: 3, y: 12 }
              : state.position;
      if (previewCondition === 'aftermath') {
        // Isolated world preview fixture; its saves remain in temporary storage.
        state.quest = 'return';
        state.defeated = ['trial', 'undead', 'boss'];
        state.flags.push('mercy', 'revenge-vowed');
        state.inventory.journal = 1;
        state.position = { x: 13, y: 5 };
      }
      await this.start(state);
    } else {
      await this.start(createGame('無名', 'sword'), true);
    }
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

  private async start(
    state: GameState,
    home = false,
    objective: ObjectiveKind = 'main',
  ): Promise<boolean> {
    this.world.setEnabled(false);
    state.position = nearestWalkable(MAPS[state.map], state.position);
    const completed = await this.transitions.run({
      label: `正在前往${MAPS[state.map].name}`,
      prepare: (progress) => this.assets.prepare(state.map, progress),
      commit: () => {
        this.view.clearDefeat();
        this.guidedObjective = objective;
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
    this.guidedObjective = activeObjective(this.state, this.guidedObjective);
    this.world.setObjective(nextObjective(this.state, this.guidedObjective));
    this.view.renderExploration(this.state, this.notice, this.guidedObjective);
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
      void this.start(destination, false, this.guidedObjective).catch((error: Error) =>
        this.toast(error.message),
      );
      return;
    }
    this.dialogueEntity = entity;
    this.dialogue = getDialogue(this.state, entity);
    this.dialogueIndex = 0;
    this.renderDialogue();
  }

  private renderDialogue(): void {
    this.openModal(
      dialoguePanel(this.dialogue!, this.dialogueIndex, this.dialogueEntity!, this.state!),
    );
    this.world.setDialogueShot(
      this.dialogueEntity!,
      this.dialogue!.beats?.[this.dialogueIndex]?.shot ??
        (this.dialogueIndex === 0 ? 'two-shot' : 'speaker'),
      () => this.view.dialogueStageHeight,
      this.reducedMotion,
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
    } else if (outcome.ending) {
      this.notice = '第一章已完成。可繼續探索全真派、後山與松風林。';
    }
    this.world.showMap(this.state);
    this.world.setEnabled(true);
    this.renderExploration();
    this.autoSave();
    if (outcome.shop) {
      this.showPanel('shop');
    }
    if (outcome.martialTraining) {
      this.showPanel('character', 'skills');
    }
    if (outcome.ending) {
      this.showEnding();
    } else if (outcome.equipmentReward) {
      this.openModal(equipmentRewardPanel(outcome.equipmentReward, outcome.message ?? ''));
    }
  }

  private startBattle(id: string): void {
    if (!this.state || !ENCOUNTERS[id]) {
      return;
    }
    this.autoSave();
    this.world.setEnabled(false);
    this.session.startBattle(id);
    this.bossTellPauseUsed = false;
    this.sparringLesson = new SparringLesson();
    if (this.state.flags.includes('sparring-lesson-seen')) {
      this.sparringLesson.skip();
    }
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

  private defeatElapsed = 0;
  private defeatPresented = false;

  private updateBattle(seconds: number): void {
    const battle = this.battle;
    if (battle?.result === 'defeat') {
      if (document.visibilityState === 'visible' && !this.view.modalVisible) {
        this.defeatElapsed += seconds;
      }
      if (this.defeatElapsed >= 1.4 && !this.defeatPresented) {
        this.defeatPresented = true;
        try {
          const record = this.saves.newestSave();
          this.view.showDefeat(
            record
              ? `${MAPS[record.state.map].name} · 第 ${record.state.level} 重\n${new Date(record.savedAt).toLocaleString('zh-TW')}`
              : '尚無可讀取的存檔。',
            !!record,
          );
        } catch {
          this.view.showDefeat('存檔無法讀取，請回主選單匯入備份。', false);
        }
      }
    } else {
      this.defeatElapsed = 0;
      this.defeatPresented = false;
    }
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
    if (
      !this.bossTellPauseUsed &&
      !battle.result &&
      battle.encounterId === 'boss' &&
      events.some((event) => event.kind === 'windup' && event.target === 'player')
    ) {
      battle.togglePause();
      this.bossTellPauseUsed = true;
    }
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
    const cue = this.sparringLesson.next(battle, events);
    if (cue) {
      this.openModal(sparringLessonPanel(cue));
    }
  }

  private finishBattle(): void {
    if (!this.state || !this.battle?.result) {
      return;
    }
    if (this.battle.result === 'defeat') {
      return;
    }
    const bossVictory = this.battle.encounterId === 'boss' && this.battle.result === 'victory';
    this.notice = this.session.finishBattle() ?? this.notice;
    this.world.showMap(this.state);
    this.world.setEnabled(true);
    this.renderExploration();
    this.autoSave();
    this.toast(this.notice);
    if (bossVictory) {
      const boss = MAPS.cave.entities.find((entity) => entity.id === 'boss');
      if (boss) {
        this.interact(boss);
      }
    }
  }

  private showPanel(panel: Panel | null, initialSection?: string): void {
    if (!this.state || this.battle || !panel) {
      return;
    }
    this.panel = panel;
    const panelContent = this.panels.render(this.state, panel, {
      saveSlots: panel === 'save' ? this.saveSlots() : [],
      reducedMotion: this.reducedMotion,
      audioVolume: this.audio.volume,
    });
    panelContent.initialSection = initialSection;
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
    this.world.endDialogueShot();
    this.view.closePanel();
    this.dialogue = null;
    this.dialogueEntity = null;
    this.panel = null;
    if (resume && this.state && !this.battle) {
      this.world.setEnabled(true);
    }
  }

  private dispatch(action: string): void {
    // 全螢幕、檔案選擇和下載保留在使用者手勢呼叫鏈內，不經過 await。
    if (action === 'fullscreen') {
      void this.toggleFullscreen();
      return;
    }
    if ((action === 'import' || action === 'export') && !this.transitions.busy) {
      if (this.battle || this.dialogue) {
        return;
      }
      if (action === 'import') {
        (document.querySelector('#import-file') as HTMLInputElement).click();
      } else if (this.state) {
        try {
          const blob = new Blob([encodeSave(this.state)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `口袋江湖-${new Date().toISOString().slice(0, 10)}.json`;
          link.hidden = true;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 30000);
          this.toast('已送出備份下載，請保留 JSON 檔。');
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Export backup failed', String(error));
          }
          this.toast(error instanceof Error ? `匯出失敗：${error.message}` : '無法匯出備份。');
        }
      }
      return;
    }
    void this.audio.unlock().then(() => this.audio.play('ui'));
    void this.handle(action).catch((error: unknown) => {
      if (import.meta.env.DEV) {
        console.error('Game action failed', action, String(error));
      }
      this.toast(error instanceof Error ? error.message : '操作失敗。');
    });
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
    if (action.startsWith('martial:')) {
      const route = action.slice(8);
      if (!this.dialogue && this.panel === 'character' && this.session.changeMartialArt(route)) {
        this.world.showMap(this.state!);
        this.renderExploration();
        this.showPanel('character', 'skills');
        this.autoSave();
        this.toast(`已改修${ROUTE_NAMES[route as Route]}，招式與內功已切換。`);
      }
      return;
    }
    if (action === 'talent-page') {
      if (!this.dialogue) {
        this.showPanel('character', 'talents');
      }
      return;
    }
    if (action.startsWith('talent:')) {
      if (!this.dialogue && this.panel === 'character') {
        const id = action.slice(7);
        if (this.session.changeTalent(id)) {
          this.renderExploration();
          this.showPanel('character', id === 'reset' ? 'talents' : `talents:${id}`);
          this.autoSave();
          this.toast(
            id === 'reset'
              ? '天賦點數已退還，可重新選擇。'
              : `已領悟${TALENTS[id as TalentId].name}。`,
          );
        } else {
          this.toast('目前無法配置。請確認剩餘點數，重新配置需回到全真山門。');
        }
      }
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
    if (action === 'dialogue-skip' && this.dialogue) {
      this.dialogueIndex = this.dialogue.lines.length - 1;
      this.renderDialogue();
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
    if (action === 'defeat-home' && this.battle?.result === 'defeat') {
      await this.start(createGame('無名', 'sword'), true);
      return;
    }
    if (action === 'defeat-load') {
      if (this.battle?.result !== 'defeat' || !this.defeatPresented) {
        return;
      }
      try {
        const record = this.saves.newestSave();
        if (record) {
          await this.start(record.state);
        } else {
          this.view.showDefeat('尚無可讀取的存檔。', false);
        }
      } catch {
        this.view.showDefeat('存檔無法讀取，請回主選單匯入備份。', false);
      }
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
        const record = this.saves.readSave(slot);
        if (!record) {
          this.toast('這份存檔已不存在，請重新選擇旅程。');
          this.showPanel('save');
          return;
        }
        this.openModal({
          title: '讀取這份進度？',
          layout: 'notice',
          rows: [
            heading(slot === 'manual' ? '手動存檔' : '自動存檔'),
            paragraph(
              `${record.state.name} · 第 ${record.state.level} 重\n${MAPS[record.state.map].name} · ${QUESTS[record.state.quest].title}\n${new Date(record.savedAt).toLocaleString('zh-TW')}`,
            ),
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
    if (action === 'rescue' && !this.battle && !this.dialogue) {
      const arrived = await this.start(this.session.prepareRescue());
      if (arrived) {
        this.autoSave();
        this.toast('路人將你送回山門，傷勢已經治好。');
      }
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
    if (action.startsWith('inspect-item:')) {
      const item = action.slice(13) as ItemId;
      if (this.state.inventory[item] > 0) {
        this.showPanel('bag', item);
      }
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
    if (action.startsWith('distance:') && this.battle) {
      this.battle.setDistance(Number(action.slice(9)));
      this.renderBattle();
      return;
    }
    if (action === 'distance-hold' && this.battle) {
      this.battle.holdingPosition = true;
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
    if (!this.battle && /^(buy|sell|use|equip|unequip):/.test(action)) {
      const [verb, id] = action.split(':') as [string, ItemId];
      const success = this.session.changeItem(
        verb as 'buy' | 'sell' | 'use' | 'equip' | 'unequip',
        id,
      );
      this.toast(
        success
          ? `${ITEMS[id].name}：${{ buy: '購買完成', sell: '出售完成', use: '使用完成', equip: '已裝備', unequip: '已卸下' }[verb]}`
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
    } else if (action.startsWith('guide:') && this.state) {
      const kind = action.slice(6);
      if (!['main', 'rest', 'herb', 'wine', 'training', 'martial'].includes(kind)) {
        return true;
      }
      this.guidedObjective = activeObjective(this.state, kind as ObjectiveKind);
      const next = nextObjective(this.state, this.guidedObjective);
      this.closeModal();
      this.renderExploration();
      if (next) {
        await this.handle(`entity:${next.id}`);
      }
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
        .map((entity) => {
          const presentation = entityPresentation(state, entity);
          return makeAction(`${presentation.name} · ${presentation.action}`, `travel:${entity.id}`);
        }),
    });
  }

  private handleBattlePanel(action: string): boolean {
    const battle = this.battle;
    if (!battle) {
      return false;
    }
    if (action.startsWith('lesson:')) {
      if (
        action !== 'lesson:defend' &&
        this.state &&
        !this.state.flags.includes('sparring-lesson-seen')
      ) {
        this.state.flags.push('sparring-lesson-seen');
      }
      if (action === 'lesson:skip') {
        this.sparringLesson.skip();
      }
      if (action === 'lesson:defend') {
        battle.holdingPosition = true;
        this.act({ type: 'defend' });
      } else {
        battle.paused = action === 'lesson:choose';
        this.closeModal(false);
        this.renderBattle();
      }
    } else if (action === 'battle-targets') {
      this.openModal({
        title: '選擇敵人',
        rows: battle.enemies.map((enemy, index) => ({
          ...makeAction(
            `${opponentName(battle.enemies, index)}${index === battle.target ? ' · 目前目標' : ''} · 生命 ${enemy.hp}/${enemy.stats.maxHp}\n${battle.intent(index)}`,
            `pick-target:${index}`,
          ),
          disabled: enemy.hp <= 0,
          selected: index === battle.target,
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
      this.openModal({ title: '我的傷勢', rows: [{ kind: 'body', body: battle.player.body }] });
    } else if (action === 'battle-help') {
      this.openModal(combatGuidePanel(battle));
    } else if (action === 'battle-help-close') {
      this.closeModal(false);
      this.renderBattle();
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
        layout: 'notice',
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
    if (this.combatPreview || !this.state || this.battle || this.dialogue) {
      return;
    }
    try {
      this.saves.writeSave(this.state, 'auto');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('自動存檔失敗', error);
      } else {
        this.toast('自動存檔失敗，請從存讀檔面板匯出備份。');
      }
    }
  }

  private toast(message: string): void {
    this.view.toast(message);
  }

  private keydown(event: KeyboardEvent): void {
    if (
      this.battle &&
      !this.view.modalVisible &&
      ['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(event.key)
    ) {
      event.preventDefault();
      this.battle.setDistance(
        this.battle.desiredDistance + (['ArrowLeft', 'a'].includes(event.key) ? -0.5 : 0.5),
      );
      this.view.updateBattleClock(this.battle);
      return;
    }
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
