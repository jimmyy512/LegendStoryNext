import { Application, Assets } from 'pixi.js';
import { createBody } from '../game/body';
import {
  LEGACY_MOTIONS,
  LegacyHero,
  type LegacyAppearance,
  type LegacyMotion,
} from '../render/LegacyHero';

export class LegacyPreview {
  private app = new Application();
  private actor: LegacyHero | null = null;
  private lifetime = new AbortController();
  private disposed = false;
  private paused = false;

  async init(onProgress: (progress: number) => void): Promise<void> {
    document.querySelector('#app')!.innerHTML = `
      <main class="injury-preview"><a href="./">← 返回口袋江湖</a>
      <p class="eyebrow">原版角色 · DRAGONBONES → SPINE 4.3</p><h1>故人重逢</h1>
      <p>原版主角素材與動作移植驗證。不讀寫旅程，普攻循環播放供檢查。傷勢以骨頭姿態覆蓋，不呈現血腥。</p>
      <div class="preview-controls">
        <label>服裝 <select id="legacy-outfit"><option value="quanzhen">全真道衣</option><option value="farmer">布衣</option><option value="blue">藍衣俠客</option></select></label>
        <label>髮型 <select id="legacy-hair"><option>Hair1</option><option>Hair2</option><option>Hair3</option><option>Hair4</option></select></label>
        <label>武器 <select id="legacy-weapon"><option value="Sword">劍</option><option value="Knife">刀</option><option value="none">空手</option></select></label>
        <label>動作 <select id="legacy-motion"><option value="Idle">待機</option><option value="Run">跑步</option><option value="NormalAttack1">普攻一</option><option value="NormalAttack2">普攻二</option><option value="NormalAttack3">普攻三</option></select></label>
        <label>傷勢 <select id="legacy-injury"><option value="healthy">完好</option><option value="rightArm">右手失能</option><option value="arms">雙手失能</option><option value="rightLeg">右腿失能</option><option value="legs">雙腿失能</option></select></label>
        <button id="legacy-pause">暫停</button><button id="legacy-step">逐格 +1/24 秒</button>
      </div><p id="legacy-status" aria-live="polite">載入中</p><div id="preview-canvas"></div></main>`;
    const base = `${import.meta.env.BASE_URL}assets/characters/legacyHero/`;
    const assets = { skeleton: `${base}legacy.json`, atlas: `${base}legacy.atlas` };
    await Assets.load([assets.skeleton, assets.atlas], onProgress);
    if (this.disposed) {
      return;
    }
    await this.app.init({ width: 1152, height: 520, background: 0x233b32, antialias: true });
    if (this.disposed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = 'auto';
    this.app.canvas.setAttribute('aria-label', '原版口袋江湖角色 Spine 動畫');
    document.querySelector('#preview-canvas')!.appendChild(this.app.canvas);
    this.actor = new LegacyHero(assets);
    this.actor.position.set(576, 440);
    this.actor.scale.set(0.9);
    this.app.stage.addChild(this.actor);
    this.app.ticker.add((ticker) => {
      if (!this.paused && !document.hidden) {
        this.actor?.update(Math.min(ticker.deltaMS / 1000, 0.05));
      }
    });
    this.bindControls();
    document.querySelector('#legacy-status')!.textContent = '原版角色已載入，待機與眨眼播放中';
  }

  dispose(): void {
    this.disposed = true;
    this.lifetime.abort();
    if (this.app.renderer) {
      this.app.destroy(true, { children: true });
    }
  }

  private bindControls(): void {
    const options = { signal: this.lifetime.signal };
    const injury = document.querySelector<HTMLSelectElement>('#legacy-injury')!;
    injury.addEventListener(
      'change',
      () => {
        const body = createBody();
        if (injury.value === 'rightArm' || injury.value === 'arms') {
          body.rightArm = 0;
        }
        if (injury.value === 'arms') {
          body.leftArm = 0;
        }
        if (injury.value === 'rightLeg' || injury.value === 'legs') {
          body.rightLeg = 0;
        }
        if (injury.value === 'legs') {
          body.leftLeg = 0;
        }
        this.actor?.setBody(body);
      },
      options,
    );
    for (const id of ['legacy-outfit', 'legacy-hair', 'legacy-weapon']) {
      document.getElementById(id)!.addEventListener(
        'change',
        () => {
          const value = (name: string) =>
            document.querySelector<HTMLSelectElement>(`#${name}`)!.value;
          this.actor?.setAppearance({
            outfit: value('legacy-outfit') as LegacyAppearance['outfit'],
            hair: value('legacy-hair') as LegacyAppearance['hair'],
            weapon: value('legacy-weapon') as LegacyAppearance['weapon'],
          });
        },
        options,
      );
    }
    const motion = document.querySelector<HTMLSelectElement>('#legacy-motion')!;
    motion.addEventListener(
      'change',
      () => {
        if (LEGACY_MOTIONS.includes(motion.value as LegacyMotion)) {
          this.actor?.playMotion(motion.value as LegacyMotion);
          document.querySelector('#legacy-status')!.textContent =
            `目前動作：${motion.selectedOptions[0].text}`;
        }
      },
      options,
    );
    const pause = document.querySelector<HTMLButtonElement>('#legacy-pause')!;
    pause.addEventListener(
      'click',
      () => {
        this.paused = !this.paused;
        pause.textContent = this.paused ? '繼續' : '暫停';
      },
      options,
    );
    document.querySelector('#legacy-step')!.addEventListener(
      'click',
      () => {
        this.paused = true;
        pause.textContent = '繼續';
        this.actor?.update(1 / 24);
      },
      options,
    );
  }
}
