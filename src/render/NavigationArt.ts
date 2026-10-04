import { Assets, Rectangle, Texture } from 'pixi.js';

export type NavigationArt =
  'nearby' | 'character' | 'bag' | 'quest' | 'menu' | 'map' | 'milestone' | 'status';
// Atlas rectangles follow the actual painted silhouettes, rather than clipping to a guessed grid.
const regions: Record<NavigationArt, [number, number, number, number]> = {
  nearby: [52, 145, 318, 320],
  character: [407, 90, 335, 410],
  bag: [790, 140, 335, 347],
  quest: [1146, 134, 386, 355],
  menu: [52, 632, 270, 266],
  map: [332, 623, 386, 291],
  milestone: [744, 568, 290, 370],
  status: [1038, 666, 495, 180],
};
export function navigationTexture(id: NavigationArt): Texture {
  const atlas = Assets.get<Texture>('ui:navigation');
  atlas.source.scaleMode = 'nearest';
  return new Texture({ source: atlas.source, frame: new Rectangle(...regions[id]) });
}
