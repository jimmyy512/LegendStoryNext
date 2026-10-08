import { Assets } from 'pixi.js';
import type { MapId } from '../game/types';
import { NPC_IDLE_FRAMES } from '../data/npcIdle';

export interface AssetBackend {
  loadBundle(name: string, progress: (value: number) => void): Promise<unknown>;
  unloadBundle(name: string): Promise<void>;
}

export const mapBundle = (map: MapId): string => `map:${map}`;

/** 共用資源常駐。換圖先準備新資源，畫面切換完成後才釋放舊地圖。 */
export class AssetService {
  private loaded = new Set<string>();
  private activeMap: string | null = null;

  constructor(private readonly backend: AssetBackend) {}

  static create(baseUrl: string): AssetService {
    Assets.addBundle('common', {
      'npc:ensemble': `${baseUrl}assets/characters/npcs/ensemble-v2.json`,
      ...Object.fromEntries(
        Object.keys(NPC_IDLE_FRAMES).map((id) => [
          `npc:${id}:idle`,
          `${baseUrl}assets/characters/npcs/${id}-idle-v1.json`,
        ]),
      ),
      'portrait:companions': `${baseUrl}assets/characters/companions/portraits-v1.json`,
      'npc:companions': `${baseUrl}assets/characters/companions/world-v2.json`,
      'title-scene': `${baseUrl}assets/ui/title-landscape.webp`,
      'ui:navigation': `${baseUrl}assets/ui/navigation/navigation-v1.png`,
      ...Object.fromEntries(
        [
          'herb',
          'tonic',
          'elixir',
          'sword',
          'wraps',
          'robe',
          'armor',
          'jade',
          'letter',
          'flower',
          'wine',
          'journal',
          'chest',
        ].map((id) => [`item-icon:${id}`, `${baseUrl}assets/icons/items/${id}.webp`]),
      ),
      waypoint: `${baseUrl}assets/ui/waypoint.svg`,
      'item-icon:chest-open': `${baseUrl}assets/icons/items/chest-open-v1.webp`,
      ...Object.fromEntries(
        Object.entries({
          'item-icon:inkPants': 'thighR',
          'item-icon:guardPants': 'thighR_greaves',
          'pants-shin:inkPants': 'shinR',
          'pants-shin:guardPants': 'shinR_greaves',
          'item-icon:brownBoots': 'bootR',
          'item-icon:swiftBoots': 'bootR_black',
          'item-icon:strawHat': 'hatStraw',
          'item-icon:taoistCrown': 'hatCrown',
        }).map(([alias, part]) => [alias, `${baseUrl}assets/icons/items/${part}.png`]),
      ),
      'pixel-hero:skeleton': `${baseUrl}assets/characters/pixelHeroine/pixel-heroine.json`,
      'pixel-hero:atlas': `${baseUrl}assets/characters/pixelHeroine/pixel-heroine.atlas`,
      'enemy:disciple': `${baseUrl}assets/characters/enemies/disciple.webp`,
      'enemy:bandit': `${baseUrl}assets/characters/enemies/bandit-chibi.webp`,
      'enemy:bandit:rig': `${baseUrl}assets/characters/enemies/bandit-rig-v1.png`,
      'enemy:bandit:slash-sheet': `${baseUrl}assets/characters/enemies/bandit-slash-v2.webp`,
      'portrait:bandit': `${baseUrl}assets/characters/enemies/bandit-portrait.webp`,
      'enemy:zombie': `${baseUrl}assets/characters/enemies/zombie-chibi.webp`,
      'enemy:boss': `${baseUrl}assets/characters/enemies/boss-chibi.webp`,
      'enemy:disciple:attack': `${baseUrl}assets/characters/enemies/disciple-attack.webp`,
      'enemy:bandit:attack': `${baseUrl}assets/characters/enemies/bandit-attack.webp`,
      'enemy:zombie:attack': `${baseUrl}assets/characters/enemies/zombie-attack.webp`,
      'enemy:boss:attack': `${baseUrl}assets/characters/enemies/boss-attack.webp`,
      'enemy:disciple:hurt': `${baseUrl}assets/characters/enemies/disciple-hurt.webp`,
      'enemy:bandit:hurt': `${baseUrl}assets/characters/enemies/bandit-hurt.webp`,
      'enemy:zombie:hurt': `${baseUrl}assets/characters/enemies/zombie-hurt.webp`,
      'enemy:boss:hurt': `${baseUrl}assets/characters/enemies/boss-hurt.webp`,
      'enemy:disciple:down': `${baseUrl}assets/characters/enemies/disciple-down.webp`,
      'enemy:bandit:down': `${baseUrl}assets/characters/enemies/bandit-down.webp`,
      'enemy:zombie:down': `${baseUrl}assets/characters/enemies/zombie-down.webp`,
      'enemy:boss:down': `${baseUrl}assets/characters/enemies/boss-down.webp`,
      'enemy:disciple:step': `${baseUrl}assets/characters/enemies/disciple-step.webp`,
      'enemy:bandit:step': `${baseUrl}assets/characters/enemies/bandit-step.webp`,
      'enemy:zombie:step': `${baseUrl}assets/characters/enemies/zombie-step.webp`,
      'enemy:boss:step': `${baseUrl}assets/characters/enemies/boss-step.webp`,
      'skill-icon:pierce': `${baseUrl}assets/icons/skills/pierce.webp`,
      'skill-icon:swordfall': `${baseUrl}assets/icons/skills/swordfall.webp`,
      'skill-icon:guard': `${baseUrl}assets/icons/skills/guard.webp`,
      'skill-icon:dragon': `${baseUrl}assets/icons/skills/dragon.webp`,
      'effect:impact': `${baseUrl}assets/effects/impact.webp`,
      'effect:pierce': `${baseUrl}assets/effects/pierce.webp`,
      'effect:swordfall': `${baseUrl}assets/effects/swordfall.webp`,
      'effect:dragon': `${baseUrl}assets/effects/dragon.webp`,
      'effect:guard': `${baseUrl}assets/effects/guard.webp`,
    });
    for (const map of ['forest', 'temple', 'mountain', 'cave'] as const) {
      Assets.addBundle(mapBundle(map), {
        [`explore:${map}`]: `${baseUrl}assets/backgrounds/exploration/${map === 'mountain' || map === 'cave' ? `${map}-clean-v2` : map}.webp`,
        [`battle:${map}`]: `${baseUrl}assets/backgrounds/battle/${map}.webp`,
      });
    }
    return new AssetService(Assets);
  }

  async prepare(map: MapId, progress: (value: number) => void): Promise<void> {
    const bundles = ['common', mapBundle(map)];
    for (let i = 0; i < bundles.length; i++) {
      const bundle = bundles[i];
      if (!this.loaded.has(bundle)) {
        await this.backend.loadBundle(bundle, (value) => progress((i + value) / bundles.length));
        this.loaded.add(bundle);
      }
      progress((i + 1) / bundles.length);
    }
  }

  async commit(map: MapId): Promise<void> {
    const next = mapBundle(map);
    if (!this.loaded.has(next)) {
      throw new Error('地圖資源尚未完成載入。');
    }
    const previous = this.activeMap;
    this.activeMap = next;
    if (previous && previous !== next) {
      await this.backend.unloadBundle(previous);
      this.loaded.delete(previous);
    }
  }
}
