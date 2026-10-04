import type { GameState, MapEntity } from './types';
import { FIRST_COMPANIONS, companionMeeting, companionProgress } from './chanceEncounters';

/** 地圖名稱與附近清單共用已探索狀態，避免把空箱當作新獎勵。 */
export function entityPresentation(state: GameState, entity: MapEntity) {
  if (entity.merchant) {
    return { name: entity.name, spent: false, action: '買賣／調息' };
  }
  if (entity.id === 'boss' && state.defeated.includes('boss')) {
    return { name: `${entity.name} · 戰後`, spent: false, action: '交談' };
  }
  const person = FIRST_COMPANIONS.find((c) => c.entity === entity.id);
  if (person) {
    const known = companionProgress(state, person.id).records.length > 0;
    const meeting = companionMeeting(state, person.id);
    return {
      name: known ? `${person.name}${meeting.ready ? ' · 新話題' : ''}` : entity.name,
      spent: false,
      action: meeting.ready ? '奇遇交談' : '回訪',
    };
  }
  const spent = entity.kind === 'chest' && state.opened.includes(entity.id);
  return {
    name: spent ? `${entity.name} · 已搜空` : entity.name,
    spent,
    action:
      entity.kind === 'chest'
        ? spent
          ? '查看空箱'
          : '搜尋物資'
        : entity.id === 'wo'
          ? '買賣／調息'
          : { npc: '交談', enemy: '戰鬥', portal: '前往', herb: '採集', clue: '調查' }[entity.kind],
  };
}
