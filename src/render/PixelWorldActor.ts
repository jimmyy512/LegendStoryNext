import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';

const INTERVAL: Record<string, number> = {
  master: 4.8,
  qing: 3.2,
  yin: 5.3,
  fong: 3.7,
  wo: 5.8,
  disciple: 3.3,
  bandit: 2.8,
  zombie: 4.4,
  boss: 3.6,
};

/** 地圖上的角色使用獨立姿勢影格，並按角色個性錯開動作。 */
export class PixelWorldActor extends Container {
  private readonly still: { root: Container; upper: Sprite; scale: number; waist: number };
  private readonly gesture: { root: Container; upper: Sprite; scale: number; waist: number };
  private readonly interval: number;
  private time: number;
  private gestureTime = 0;
  private breathTime = 0;

  constructor(
    kind: 'npc' | 'enemy',
    id: string,
    scale: number,
    private readonly wounded = false,
  ) {
    super();
    const stillTexture = Assets.get<Texture>(`${kind}:${id}${wounded ? ':down' : ''}`);
    const gestureTexture = wounded
      ? stillTexture
      : Assets.get<Texture>(`${kind}:${id}:${kind === 'npc' ? 'gesture' : 'attack'}`);
    stillTexture.source.scaleMode = 'nearest';
    gestureTexture.source.scaleMode = 'nearest';
    const base = kind === 'npc' ? 62 / stillTexture.height : scale;
    const pose = (texture: Texture, name: string) => {
      const root = new Container();
      root.label = name;
      const w = texture.width * base,
        h = texture.height * base;
      const waist = -h * 0.38;
      const lower = new Sprite(texture),
        upper = new Sprite(texture);
      for (const sprite of [lower, upper]) {
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(base);
      }
      lower.label = 'planted-lower-body';
      upper.label = 'breathing-upper-body';
      const lowerMask = new Graphics().rect(-w / 2, waist, w, -waist + 1).fill(0xffffff);
      const upperMask = new Graphics().rect(-w / 2, -h - 1, w, h + waist + 2).fill(0xffffff);
      root.addChild(lower, upper, lowerMask, upperMask);
      lower.mask = lowerMask;
      upper.mask = upperMask;
      this.addChild(root);
      return { root, upper, scale: base, waist };
    };
    this.still = pose(stillTexture, 'still-pose');
    this.gesture = pose(gestureTexture, 'gesture-pose');
    this.gesture.root.visible = false;
    this.interval = wounded ? Infinity : (INTERVAL[id] ?? 4);
    this.time = (id.length * 0.77) % this.interval;
    this.breathTime = this.time;
  }

  playGesture(): void {
    this.gestureTime = 0.7;
  }

  update(dt: number): void {
    this.time += dt;
    this.breathTime += dt;
    if (this.time >= this.interval) {
      this.time %= this.interval;
      this.playGesture();
    }
    this.gestureTime = Math.max(0, this.gestureTime - dt);
    const active = this.gestureTime > 0;
    this.still.root.visible = !active;
    this.gesture.root.visible = active;
    // 腳、腿與腰線不移動。只有腰線上方微幅呼吸，動作計時不重設呼吸相位。
    const expansion = this.wounded ? 1 : 1 + Math.sin(this.breathTime * 1.65) * 0.004;
    for (const pose of [this.still, this.gesture]) {
      pose.upper.scale.y = pose.scale * expansion;
      pose.upper.y = pose.waist * (1 - expansion);
    }
  }
}
