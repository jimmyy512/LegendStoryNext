import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { dragonProgress, pixelPalmFrame } from './comparisonTiming';

export class ComparisonStage {
  private app = new Application();
  private root = new Container();
  private heroine: Spine | null = null;
  private pixelHero: Sprite | null = null;
  private frames: Texture[] = [];
  private dragon = new Sprite();
  private energy = new Graphics();
  private disposed = false;
  private ready = false;

  constructor(private readonly pixel: boolean) {}

  async init(host: HTMLElement, base: string): Promise<void> {
    await this.app.init({
      width: this.pixel ? 300 : 600,
      height: this.pixel ? 200 : 400,
      antialias: !this.pixel,
      background: 0x102622,
      resolution: 1,
      autoStart: false,
    });
    this.ready = true;
    if (this.disposed) {
      this.app.destroy(true, { children: true });
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute(
      'aria-label',
      this.pixel ? '像素女俠原地施展降龍十八掌' : 'Q 版 Spine 女俠原地施展降龍十八掌',
    );
    this.root.scale.set(this.pixel ? 0.5 : 1);
    this.app.stage.addChild(this.root);
    this.drawStage();
    if (this.pixel) {
      const sheet = Assets.get<Texture>(`${base}heroine-pixel.png`);
      sheet.source.scaleMode = 'nearest';
      this.frames = Array.from(
        { length: 8 },
        (_, index) =>
          new Texture({
            source: sheet.source,
            frame: new Rectangle((index % 4) * 384, Math.floor(index / 4) * 512, 384, 512),
          }),
      );
      this.pixelHero = new Sprite(this.frames[0]);
      this.pixelHero.anchor.set(0.5, 0.94);
      this.pixelHero.position.set(135, 323);
      this.pixelHero.scale.set(0.43);
      this.root.addChild(this.pixelHero);
    } else {
      this.heroine = Spine.from({
        skeleton: `${base}heroine.json`,
        atlas: `${base}heroine.atlas`,
        autoUpdate: false,
      });
      this.heroine.position.set(130, 328);
      this.heroine.scale.set(0.7);
      this.heroine.state.setAnimation(0, 'dragonPalm', false);
      this.root.addChild(this.heroine);
    }
    this.dragon.texture = Assets.get<Texture>(`${base}dragon.png`);
    this.dragon.anchor.set(1, 0.5);
    this.root.addChild(this.energy, this.dragon);
    this.render(0);
  }

  render(time: number): void {
    if (!this.ready || this.disposed) {
      return;
    }
    if (this.heroine) {
      this.heroine.skeleton.setupPose();
      this.heroine.state.getTrack(0)!.trackTime = time;
      this.heroine.update(0);
    }
    if (this.pixelHero) {
      this.pixelHero.texture = this.frames[pixelPalmFrame(time)];
    }
    this.drawEnergy(time);
    this.app.renderer.render(this.app.stage);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.ready) {
      this.app.destroy(true, { children: true });
    }
    for (const frame of this.frames) {
      frame.destroy(false);
    }
    this.frames = [];
  }

  private drawStage(): void {
    const background = new Graphics();
    background.rect(0, 0, 600, 400).fill(0x102622);
    background.circle(466, 88, 38).fill(0x8a9977);
    background
      .poly([0, 245, 80, 111, 165, 195, 273, 91, 430, 232, 500, 170, 600, 234, 600, 400, 0, 400])
      .fill(0x233e34);
    background
      .poly([0, 280, 90, 210, 190, 280, 330, 158, 480, 250, 600, 208, 600, 400, 0, 400])
      .fill(0x345043);
    background.rect(0, 322, 600, 78).fill(0x4c5847);
    background.rect(0, 322, 600, 4).fill(0xaab18e);
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 10; column++) {
        background
          .rect(column * 68 + (row % 2) * 34, 335 + row * 26, 62, 19)
          .stroke({ width: 1, color: 0x727e61, alpha: 0.45 });
      }
    }
    background.ellipse(133, 324, 43, 7).fill({ color: 0x081b16, alpha: 0.5 });
    this.root.addChild(background);
  }

  private drawEnergy(time: number): void {
    const progress = dragonProgress(time);
    const casting = time >= 0.82 && time < 1.97;
    this.dragon.visible = casting;
    this.dragon.position.set(330 + progress * 245, 236 - Math.sin(progress * Math.PI) * 10);
    this.dragon.width = 100 + Math.sin((progress * Math.PI) / 2) * 220;
    this.dragon.height = this.dragon.width * 0.38;
    this.dragon.alpha = Math.min(1, progress * 8, (1 - progress) * 5);
    this.energy.clear();
    if (time > 0.22 && time < 0.82) {
      const charge = (time - 0.22) / 0.6;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + time * 4;
        const radius = 38 * (1 - charge) + 8;
        this.energy
          .rect(155 + Math.cos(angle) * radius, 230 + Math.sin(angle) * radius, 3, 3)
          .fill(0xffd978);
      }
      this.energy.circle(155, 230, 4 + charge * 9).fill({ color: 0xffde83, alpha: charge * 0.65 });
    }
    if (!casting) {
      return;
    }
    for (let i = 0; i < 18; i++) {
      const travel = (progress + i / 18) % 1;
      const x = 170 + travel * 350;
      const y = 210 + Math.sin(i * 2.4 + progress * 7) * (10 + travel * 33);
      this.energy
        .rect(x, y, 6 + travel * 12, this.pixel ? 4 : 2)
        .fill({ color: i % 3 ? 0xffd25d : 0xfff2b1, alpha: (1 - travel) * this.dragon.alpha });
    }
    this.energy
      .ellipse(185, 220, 15 + progress * 40, 32 + progress * 28)
      .stroke({ color: 0xffd36a, width: 3, alpha: (1 - progress) * 0.8 });
  }
}
