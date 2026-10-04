import type { HairStyle } from './appearance';
import type { TalentId } from './talents';
import type { BodyState, LimbRequirement } from './body';

export type Route = 'sword' | 'fist';
export type MapId = 'forest' | 'temple' | 'mountain' | 'cave';
export type ItemId =
  | 'herb'
  | 'tonic'
  | 'elixir'
  | 'sword'
  | 'wraps'
  | 'robe'
  | 'armor'
  | 'inkPants'
  | 'guardPants'
  | 'brownBoots'
  | 'swiftBoots'
  | 'strawHat'
  | 'taoistCrown'
  | 'jade'
  | 'letter'
  | 'flower'
  | 'wine'
  | 'journal';
export type QuestStage =
  'arrival' | 'trial' | 'report' | 'bandits' | 'investigate' | 'boss' | 'return' | 'complete';
export interface Point {
  x: number;
  y: number;
}
export interface Stats {
  maxHp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
}
export interface GameState {
  version: 3;
  hair: HairStyle;
  body: BodyState;
  name: string;
  route: Route;
  map: MapId;
  position: Point;
  hp: number;
  mp: number;
  level: number;
  talents: TalentId[];
  xp: number;
  gold: number;
  inventory: Record<ItemId, number>;
  weapon: 'sword' | 'wraps' | null;
  armor: 'robe' | 'armor' | null;
  pants: 'inkPants' | 'guardPants' | null;
  boots: 'brownBoots' | 'swiftBoots' | null;
  headwear: 'strawHat' | 'taoistCrown' | null;
  quest: QuestStage;
  flags: string[];
  defeated: string[];
  opened: string[];
  playSeconds: number;
}
export interface ItemDefinition {
  name: string;
  description: string;
  kind: 'medicine' | 'weapon' | 'armor' | 'quest';
  price: number;
  hp?: number;
  mp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
}
export type EntityKind = 'npc' | 'enemy' | 'portal' | 'chest' | 'herb' | 'clue';
export interface MapEntity extends Point {
  id: string;
  name: string;
  kind: EntityKind;
  color?: number;
  to?: MapId;
  spawn?: Point;
  encounter?: string;
  art?: string;
}
export interface MapDefinition {
  id: MapId;
  name: string;
  subtitle: string;
  description: string;
  palette: { ground: number; light: number; dark: number; path: number };
  blocks: {
    x: number;
    y: number;
    w: number;
    h: number;
    kind: 'tree' | 'building' | 'rock' | 'water';
  }[];
  /** Inclusive traversable x-ranges per row for painted maps with cliffs or water. */
  walkableRows?: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  entities: MapEntity[];
}
export interface EnemyDefinition extends Stats {
  name: string;
  color: number;
  xp: number;
  gold: number;
  heavyEvery: number;
}
export interface EncounterDefinition {
  name: string;
  enemies: string[];
  escapable: boolean;
}
export interface Skill {
  limbs: LimbRequirement;
  id: string;
  name: string;
  description: string;
  cost: number;
  multiplier: number;
  effect?: 'break' | 'counter';
}
