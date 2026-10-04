import { Application, Assets, Container, Graphics, Text, Texture } from 'pixi.js';
import { HumanoidEnemyRig, type EnemyRigMotion } from '../render/HumanoidEnemyRig';
import { createBody } from '../game/body';

/** Isolated art acceptance surface. Never reads or writes the player's journey. */
export class EnemyRigPreview {
  private app = new Application();
  private elapsed = 0;
  private paused = false;
  private lifetime = new AbortController();
  async init(): Promise<void> {
    document.querySelector('#app')!.innerHTML =
      '<main><h1>小怪骨架驗收</h1><p>刀客已接入本機戰鬥。各姿態共用同一組關節與素材，其餘敵人仍待轉接。</p><button id="rig-pause">暫停／繼續</button><button id="rig-contact">命中影格</button><button id="rig-fall">倒地中段</button><button id="rig-end">檢查終態</button><button id="rig-restart">重新播放</button><button id="rig-healthy">完好</button><button id="rig-hand">右手失能</button><button id="rig-hands">雙手失能</button><button id="rig-leg">右腿失能</button><button id="rig-legs">雙腿失能</button><div id="rig-canvas"></div></main>';
    await this.app.init({
      width: 1440,
      height: 680,
      background: 0x263c35,
      antialias: false,
      resolution: 1,
    });
    document.querySelector('#rig-canvas')!.appendChild(this.app.canvas);
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = 'auto';
    this.app.canvas.setAttribute('aria-label', '刀客共用骨架七種姿態');
    const texture = await Assets.load<Texture>(
      `${import.meta.env.BASE_URL}assets/characters/enemies/bandit-rig-v1.png`,
    );
    const motions: EnemyRigMotion[] = ['idle', 'walk', 'windup', 'strike', 'hurt', 'guard', 'down'];
    const actors = motions.map((motion, index) => {
      const tile = new Container();
      tile.position.set(30 + (index % 4) * 350, 28 + Math.floor(index / 4) * 320);
      tile.addChild(new Graphics().rect(0, 0, 330, 295).fill(0x142820));
      const title = new Text({ text: motion, style: { fill: 0xeee4ca, fontSize: 18 } });
      title.position.set(12, 8);
      tile.addChild(title);
      const actor = new HumanoidEnemyRig(texture);
      actor.position.set(160, 278);
      actor.scale.set(1.25);
      tile.addChild(actor);
      this.app.stage.addChild(tile);
      return actor;
    });
    document.querySelector('#rig-pause')!.addEventListener(
      'click',
      () => {
        this.paused = !this.paused;
      },
      { signal: this.lifetime.signal },
    );
    for (const [id, parts] of [
      ['rig-healthy', []],
      ['rig-hand', ['rightArm']],
      ['rig-hands', ['rightArm', 'leftArm']],
      ['rig-leg', ['rightLeg']],
      ['rig-legs', ['rightLeg', 'leftLeg']],
    ] as const) {
      document.querySelector(`#${id}`)!.addEventListener(
        'click',
        () => {
          const body = createBody();
          for (const part of parts) {
            body[part] = 0;
          }
          actors.forEach((actor) => actor.setBody(body));
        },
        { signal: this.lifetime.signal },
      );
    }
    document.querySelector('#rig-end')!.addEventListener(
      'click',
      () => {
        this.elapsed = 1.2;
        this.paused = true;
      },
      { signal: this.lifetime.signal },
    );
    for (const [id, time] of [
      ['rig-contact', 0.14],
      ['rig-fall', 0.45],
    ] as const) {
      document.querySelector(`#${id}`)!.addEventListener(
        'click',
        () => {
          this.elapsed = time;
          this.paused = true;
        },
        { signal: this.lifetime.signal },
      );
    }
    document.querySelector('#rig-restart')!.addEventListener(
      'click',
      () => {
        this.elapsed = 0;
        this.paused = false;
      },
      { signal: this.lifetime.signal },
    );
    this.app.ticker.add((ticker) => {
      if (!this.paused) {
        this.elapsed += Math.min(0.05, ticker.deltaMS / 1000);
      }
      actors.forEach((actor, index) =>
        actor.pose(
          motions[index],
          ['idle', 'walk'].includes(motions[index]) ? this.elapsed : this.elapsed % 1.6,
        ),
      );
    });
  }
  dispose(): void {
    this.lifetime.abort();
    this.app.destroy(true, { children: true });
  }
}
