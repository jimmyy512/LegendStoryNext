import type { GameState } from './types';

export const TALENT_IDS = ['opening', 'breath', 'footwork'] as const;
export type TalentId = (typeof TALENT_IDS)[number];

export const TALENTS = {
  opening: {
    name: '乘隙而入',
    style: '追擊',
    icon: 'skill-icon:pierce',
    effect: '命中破綻時，傷害加成由 35% 提高至 55%。',
    hint: '等對手重擊收招，再以普攻或招式追擊。每次破綻只強化一次命中。',
  },
  breath: {
    name: '守中養氣',
    style: '防守',
    icon: 'skill-icon:guard',
    effect: '防禦或護體接下重擊並存活時，恢復 4 點內力。',
    hint: '看準重擊起手再防守，替下一招留住內力。普通攻擊不會觸發。',
  },
  footwork: {
    name: '游身卸力',
    style: '走位',
    icon: 'item-icon:swiftBoots',
    effect: '讓敵人的重擊落空時，恢復 15 點腳力。',
    hint: '對手起手後退到射程外，再趁收招靠近。普通攻擊落空不會觸發。',
  },
} as const;

/** 第一章第 2、3 重各獲一點，不因讀檔或重複升級額外發放。 */
export function earnedTalentPoints(state: Pick<GameState, 'level'>): number {
  return Math.min(2, Math.max(0, state.level - 1));
}

export function availableTalentPoints(state: Pick<GameState, 'level' | 'talents'>): number {
  return earnedTalentPoints(state) - state.talents.length;
}

export function learnTalent(state: GameState, id: string): boolean {
  if (
    !TALENT_IDS.includes(id as TalentId) ||
    state.talents.includes(id as TalentId) ||
    availableTalentPoints(state) < 1
  ) {
    return false;
  }
  state.talents.push(id as TalentId);
  return true;
}

export function resetTalents(state: GameState): boolean {
  if (state.map !== 'temple' || !state.talents.length) {
    return false;
  }
  state.talents = [];
  return true;
}
