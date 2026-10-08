import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { NPC_FRAMES, type NpcAction } from '../data/npcFrames';
import { ENEMY_FRAME_BASELINES } from './EnemyFrameRegistration';

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

const IDLE_FPS = 5;
/** 四格手勢：起手、半途、完整手勢停留、收回。 */
const GESTURE_TIMING = [0.1, 0.12, 0.55, 0.15];
const STILL_GESTURE_TIME = 0.7;

interface Pose {
  root: Container;
  lower: Sprite;
  upper: Sprite;
  scale: number;
  waist: number;
}

/** 地圖上的角色使用獨立姿勢影格，並按角色個性錯開動作。 */
export class PixelWorldActor extends Container {
  private readonly still: Pose;
  private readonly gesture: Pose;
  private readonly idleFrames: Texture[];
  private readonly gestureFrames: Texture[];
  private readonly gestureTiming: number[];
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
    const frames = (action: NpcAction) =>
      kind === 'npc' && !wounded
        ? Array.from({ length: NPC_FRAMES[id]?.[action] ?? 0 }, (_, i) => {
            const frame = Assets.get<Texture>(`npc:${id}:${action}:${i}`);
            frame.source.scaleMode = 'nearest';
            return frame;
          })
        : [];
    this.idleFrames = frames('idle');
    this.gestureFrames = frames('gesture');
    this.gestureTiming =
      this.gestureFrames.length === GESTURE_TIMING.length
        ? GESTURE_TIMING
        : this.gestureFrames.map(() => STILL_GESTURE_TIME / this.gestureFrames.length);
    const pose = (texture: Texture, name: string, key: string, extra: Texture[] = []) => {
      const root = new Container();
      root.label = name;
      // 遮罩須涵蓋同一姿勢所有影格中最寬、最高者，避免髮梢被切。
      const w = Math.max(texture.width, ...extra.map((t) => t.width)) * base,
        h = Math.max(texture.height, ...extra.map((t) => t.height)) * base;
      const baseline = ENEMY_FRAME_BASELINES[key] ?? 1;
      const waist = -h * baseline * 0.38;
      const lower = new Sprite(texture),
        upper = new Sprite(texture);
      for (const sprite of [lower, upper]) {
        sprite.anchor.set(0.5, baseline);
        sprite.scale.set(base);
      }
      lower.label = 'planted-lower-body';
      upper.label = 'breathing-upper-body';
      const lowerMask = new Graphics().rect(-w / 2, waist, w, -waist + 1).fill(0xffffff);
      const upperMask = new Graphics()
        .rect(-w / 2, -h * baseline - 1, w, h * baseline + waist + 2)
        .fill(0xffffff);
      root.addChild(lower, upper, lowerMask, upperMask);
      lower.mask = lowerMask;
      upper.mask = upperMask;
      this.addChild(root);
      return { root, lower, upper, scale: base, waist };
    };
    this.still = pose(
      stillTexture,
      'still-pose',
      `${kind}:${id}${wounded ? ':down' : ''}`,
      this.idleFrames,
    );
    this.gesture = pose(
      gestureTexture,
      'gesture-pose',
      `${kind}:${id}:${kind === 'npc' ? 'gesture' : 'attack'}`,
      this.gestureFrames,
    );
    this.gesture.root.visible = false;
    this.interval = wounded ? Infinity : (INTERVAL[id] ?? 4);
    this.time = (id.length * 0.77) % this.interval;
    this.breathTime = this.time;
  }

  playGesture(): void {
    this.gestureTime = this.gestureFrames.length
      ? this.gestureTiming.reduce((sum, t) => sum + t, 0)
      : STILL_GESTURE_TIME;
  }

  update(dt: number): void {
    this.time += dt;
    this.breathTime += dt;
    if (this.time >= this.interval) {
      this.time %= this.interval;
      if (this.gestureTime <= 0) {
        this.playGesture();
      }
    }
    this.gestureTime = Math.max(0, this.gestureTime - dt);
    const active = this.gestureTime > 0;
    this.still.root.visible = !active;
    this.gesture.root.visible = active;
    if (active && this.gestureFrames.length > 0) {
      let left = this.gestureTiming.reduce((sum, t) => sum + t, 0) - this.gestureTime;
      let index = 0;
      while (index < this.gestureFrames.length - 1 && left >= this.gestureTiming[index]) {
        left -= this.gestureTiming[index++];
      }
      this.gesture.lower.texture = this.gestureFrames[index];
      this.gesture.upper.texture = this.gestureFrames[index];
    }
    if (this.idleFrames.length > 0) {
      // 有逐格待機時，呼吸與髮帶擺動由影格本身表現，不再疊加縮放。
      const frame =
        this.idleFrames[Math.floor(this.breathTime * IDLE_FPS) % this.idleFrames.length];
      this.still.lower.texture = frame;
      this.still.upper.texture = frame;
      return;
    }
    // 腳、腿與腰線不移動。只有腰線上方微幅呼吸，動作計時不重設呼吸相位。
    const expansion = this.wounded ? 1 : 1 + Math.sin(this.breathTime * 1.65) * 0.004;
    for (const pose of [this.still, this.gesture]) {
      pose.upper.scale.y = pose.scale * expansion;
      pose.upper.y = pose.waist * (1 - expansion);
    }
  }
}
