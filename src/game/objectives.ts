import { MAPS } from '../data/maps';
import { BODY_PARTS, PART_CAPACITY } from './body';
import { getStats } from './state';
import type { GameState, MapEntity, MapId } from './types';

export type ObjectiveKind = 'main' | 'herb' | 'wine' | 'rest' | 'training' | 'martial';

/** A chosen detour stays selected through map travel until its purpose is fulfilled. */
export function activeObjective(state: GameState, requested: ObjectiveKind): ObjectiveKind {
  if (requested === 'rest') {
    const stats = getStats(state);
    const recovered =
      state.hp >= stats.maxHp &&
      state.mp >= stats.maxMp &&
      BODY_PARTS.every((part) => state.body[part] === PART_CAPACITY[part]);
    if (recovered) {
      return 'main';
    }
  }
  return nextObjective(state, requested) ? requested : 'main';
}

/** Resolve the next local interaction, never teleport or bypass story gates. */
export function nextObjective(state: GameState, kind: ObjectiveKind = 'main'): MapEntity | null {
  let destination: MapId = 'temple';
  let id = 'qing';
  if (kind === 'martial') {
    if (state.flags.includes('martial-cross-trained')) {
      return null;
    }
  } else if (kind === 'training') {
    if (state.map === 'temple') {
      return null;
    }
  } else if (kind === 'rest') {
    id = 'wo';
  } else if (kind === 'herb') {
    if (state.flags.includes('herb-done')) {
      return null;
    }
    destination = state.inventory.flower > 0 ? 'temple' : 'mountain';
    id = state.inventory.flower > 0 ? 'yin' : 'flower';
  } else if (kind === 'wine') {
    if (state.flags.includes('wine-done')) {
      return null;
    }
    destination = state.inventory.wine > 0 ? 'temple' : 'forest';
    id = state.inventory.wine > 0 ? 'fong' : 'wine';
  } else {
    switch (state.quest) {
      case 'complete':
        return null;
      case 'trial':
        id = 'trial';
        break;
      case 'report':
      case 'return':
        id = 'master';
        break;
      case 'bandits':
        destination = 'forest';
        id = state.flags.includes('seek-bandits') ? 'bandits' : 'wounded';
        break;
      case 'investigate':
        destination = 'cave';
        id = 'journal';
        break;
      case 'boss':
        destination = 'cave';
        id = state.defeated.includes('undead') ? 'boss' : 'undead';
        break;
    }
  }
  if (destination === state.map) {
    return MAPS[state.map].entities.find((entity) => entity.id === id) ?? null;
  }
  const queue: { map: MapId; first: MapEntity | null }[] = [{ map: state.map, first: null }];
  const visited = new Set<MapId>([state.map]);
  for (const step of queue) {
    for (const portal of MAPS[step.map].entities) {
      if (!portal.to || visited.has(portal.to)) {
        continue;
      }
      const first = step.first ?? portal;
      if (portal.to === destination) {
        return first;
      }
      visited.add(portal.to);
      queue.push({ map: portal.to, first });
    }
  }
  return null;
}

export function objectiveLabel(entity: MapEntity): string {
  const verb = {
    portal: '前往',
    npc: '交談：',
    enemy: '挑戰：',
    clue: '調查：',
    herb: '尋找：',
    chest: '查看：',
  }[entity.kind];
  return `${verb}${entity.name}`;
}
