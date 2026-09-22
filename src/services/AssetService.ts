import { Assets } from 'pixi.js';
import type { MapId } from '../game/types';
import { HERO_ASSETS } from '../render/heroAppearance';

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
      waypoint: `${baseUrl}assets/ui/waypoint.svg`,
      [HERO_ASSETS.skeleton]: `${baseUrl}assets/characters/legacyHero/legacy.json`,
      [HERO_ASSETS.atlas]: `${baseUrl}assets/characters/legacyHero/legacy.atlas`,
    });
    for (const map of ['forest', 'temple', 'mountain', 'cave'] as const) {
      Assets.addBundle(mapBundle(map), {
        [`ground:${map}`]: `${baseUrl}assets/scenes/${map}.svg`,
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
