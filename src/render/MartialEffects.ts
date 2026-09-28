import { Assets, Rectangle, Sprite, Texture } from 'pixi.js';

/** tools/pixelEffects.py 產生的金庸掌拳指法逐格特效。 */
export type MartialArt = {
  id: string;
  name: string;
  file: string;
  frames: number;
  width: number;
  height: number;
  pad: number;
  /** 出手點（掌心、拳面、指尖）在每格裡的位置。 */
  anchor: [number, number];
  /** travel：出手後整團往前推進；stretch：光束類，從出手點往前拉長。 */
  reach?: 'travel' | 'stretch';
};

/** 前兩格（蓄勁、出手）留在掌心，之後逐格往前推，最後一格比原圖遠這麼多像素。 */
export const EFFECT_TRAVEL = 70;

const BASE = `${import.meta.env.BASE_URL}assets/effects/martial/`;

export async function loadMartialArts(): Promise<MartialArt[]> {
  // 特效還沒建出來時照常運作，只是沒有掌法可選。
  const manifest = (await Assets.load(`${BASE}effects.json`).catch(() => null)) as {
    arts: MartialArt[];
  } | null;
  const arts = manifest?.arts ?? [];
  await Assets.load(arts.map((art) => `${BASE}${art.file}`));
  return arts;
}

/** 一個特效播放器：依出招時間挑格，把出手點對在出手的掌心上。 */
export class MartialEffect extends Sprite {
  private textures: Texture[] = [];
  private art: MartialArt | null = null;

  use(art: MartialArt): void {
    if (this.art?.id === art.id) {
      return;
    }
    this.art = art;
    const source = Assets.get<Texture>(`${BASE}${art.file}`).source;
    source.scaleMode = 'nearest';
    this.textures = Array.from(
      { length: art.frames },
      (_, i) =>
        new Texture({
          source,
          frame: new Rectangle(i * (art.width + art.pad), 0, art.width, art.height),
        }),
    );
  }

  /** progress 0~1 對應第一格到最後一格；範圍外隱藏。 */
  show(origin: { x: number; y: number }, progress: number): void {
    const art = this.art;
    this.visible = !!art && progress >= 0 && progress < 1;
    if (!art || !this.visible) {
      return;
    }
    const frame = Math.min(art.frames - 1, Math.floor(progress * art.frames));
    this.texture = this.textures[frame];
    // 逐格整數位移，不做連續移動，像素才不會閃爍。
    const reach = Math.max(0, frame - 1) / Math.max(1, art.frames - 2);
    const stretch = art.reach === 'stretch';
    this.scale.x = stretch ? 1 + (EFFECT_TRAVEL / art.width) * reach : 1;
    const shift = stretch ? 0 : Math.round(EFFECT_TRAVEL * reach);
    this.position.set(
      Math.round(origin.x) - Math.round(art.anchor[0] * this.scale.x) + shift,
      Math.round(origin.y) - art.anchor[1],
    );
  }
}
