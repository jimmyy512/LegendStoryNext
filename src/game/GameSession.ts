import { MAPS } from '../data/maps';
import { isHairStyle } from './appearance';
import { Battle, type BattleAction } from './battle';
import { isWalkable } from './pathfinding';
import { buy, equip, unequip, sell, useMedicine, restore } from './state';
import { movementRate } from './body';
import { learnTalent, resetTalents } from './talents';
import { changeMartialArt } from './martialTraining';
import { applyStoryAction, getDialogue, settleBattle } from './story';
import type { GameState, ItemId, MapEntity, Point } from './types';

/** 一次旅程的唯一寫入入口。畫面拿到副本，不能直接改任務、物品或位置。 */
export class GameSession {
  private current: GameState | null = null;
  private encounter: Battle | null = null;

  get state(): GameState | null {
    return this.current ? structuredClone(this.current) : null;
  }

  get battle(): Battle | null {
    return this.encounter;
  }

  start(state: GameState): void {
    this.current = structuredClone(state);
    this.encounter = null;
  }

  end(): void {
    this.current = null;
    this.encounter = null;
  }

  advanceTime(): void {
    if (this.current) {
      this.current.playSeconds = Math.min(999999, this.current.playSeconds + 1);
    }
  }

  move(point: Point): void {
    if (!this.current || this.encounter || !isWalkable(MAPS[this.current.map], point)) {
      return;
    }
    this.current.position = { ...point };
  }

  prepareTravel(entity: MapEntity): GameState {
    const state = this.current;
    if (!state || this.encounter || entity.kind !== 'portal' || !entity.to || !entity.spawn) {
      throw new Error('目前無法前往該地區。');
    }
    const portal = MAPS[state.map].entities.find((entry) => entry.id === entity.id);
    if (!portal || portal.to !== entity.to) {
      throw new Error('入口不存在。');
    }
    if (
      ((state.map === 'temple' && entity.to === 'mountain') ||
        (state.map === 'mountain' && entity.to === 'cave')) &&
      ['arrival', 'trial', 'report', 'bandits'].includes(state.quest)
    ) {
      throw new Error('禁地暫不開放，先完成山下的委託。');
    }
    const candidate = structuredClone(state);
    candidate.map = entity.to;
    candidate.position = { ...entity.spawn };
    return candidate;
  }

  /** 四肢失能時仍可脫困；換圖成功前不改動目前旅程。 */
  prepareRescue(): GameState {
    if (!this.current || this.encounter || movementRate(this.current.body) > 0) {
      throw new Error('只有無法移動時才能請人送回山門。');
    }
    const state = structuredClone(this.current);
    state.map = 'temple';
    state.position = { x: 3, y: 7 };
    restore(state);
    return state;
  }

  choose(entity: MapEntity, action: string): ReturnType<typeof applyStoryAction> {
    if (!this.current || this.encounter) {
      return {};
    }
    const dialogue = getDialogue(this.current, entity);
    if (!dialogue.choices.some((choice) => choice.action === action)) {
      return {};
    }
    return applyStoryAction(this.current, action);
  }

  startBattle(id: string): void {
    if (!this.current || this.encounter) {
      return;
    }
    this.encounter = new Battle(this.current, id);
  }

  act(action: BattleAction): string | null {
    return this.encounter?.act(action) ?? null;
  }

  finishBattle(): string | null {
    if (!this.current || !this.encounter?.result) {
      return null;
    }
    const message = settleBattle(this.current, this.encounter);
    this.encounter = null;
    return message;
  }

  changeItem(verb: 'buy' | 'sell' | 'use' | 'equip' | 'unequip', id: ItemId): boolean {
    if (!this.current || this.encounter) {
      return false;
    }
    return { buy, sell, use: useMedicine, equip, unequip }[verb](this.current, id);
  }

  changeHair(hair: string): boolean {
    if (!this.current || this.encounter || !isHairStyle(hair)) {
      return false;
    }
    this.current.hair = hair;
    return true;
  }

  changeTalent(id: string): boolean {
    if (!this.current || this.encounter) {
      return false;
    }
    return id === 'reset' ? resetTalents(this.current) : learnTalent(this.current, id);
  }

  changeMartialArt(route: string): boolean {
    return !!this.current && !this.encounter && changeMartialArt(this.current, route);
  }
}
