import { MAPS } from '../data/maps';
import { isHairStyle } from './appearance';
import { Battle, type BattleAction } from './battle';
import { isWalkable } from './pathfinding';
import { buy, equip, sell, useMedicine } from './state';
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
      (entity.to === 'mountain' || entity.to === 'cave') &&
      ['arrival', 'trial', 'report', 'bandits'].includes(state.quest)
    ) {
      throw new Error('禁地暫不開放，先完成山下的委託。');
    }
    const candidate = structuredClone(state);
    candidate.map = entity.to;
    candidate.position = { ...entity.spawn };
    return candidate;
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

  changeItem(verb: 'buy' | 'sell' | 'use' | 'equip', id: ItemId): boolean {
    if (!this.current || this.encounter) {
      return false;
    }
    return { buy, sell, use: useMedicine, equip }[verb](this.current, id);
  }

  changeHair(hair: string): boolean {
    if (!this.current || this.encounter || !isHairStyle(hair)) {
      return false;
    }
    this.current.hair = hair;
    return true;
  }
}
