import { Application, Assets } from 'pixi.js';
import { SpineHero, type HeroAppearance, type HeroMotion } from '../render/SpineHero';

/** 換裝製作台不讀寫遊戲存檔，供美術與骨架逐批驗收。 */
export class SpinePreview {
  private app = new Application();
  private actor: SpineHero | null = null;
  private lifetime = new AbortController();
  private paused = false;
  private disposed = false;

  async init(onProgress: (progress: number) => void): Promise<void> {
    document.querySelector('#app')!.innerHTML = `
      <main class="injury-preview"><a href="./">← 返回口袋江湖</a>
      <p class="eyebrow">SPINE 4.3 · 可編輯角色樣板</p><h1>衣冠演武</h1>
      <p>真實 Spine 骨架與 Skin 換裝。這是製作樣板，不讀寫旅程。素材接縫與握劍手型尚待精修。</p>
      <div class="preview-controls">
        <label>衣服 <select id="spine-outfit"><option value="ivory">米白道衣</option><option value="jade">青衣</option></select></label>
        <label>髮型 <select id="spine-hair"><option value="topknot">束髮</option><option value="tied">垂髮</option></select></label>
        <label>武器 <select id="spine-weapon"><option value="plain">素劍</option><option value="jade">青玉劍</option><option value="none">空手</option></select></label>
        <label><input id="spine-injury" type="checkbox">右手失能，改左手持劍</label>
      </div>
      <div class="preview-controls" id="spine-motions">
        <button data-motion="idle">待機</button><button data-motion="walk">走路</button>
        <button data-motion="attack">揮劍</button><button data-motion="hurt">受擊</button>
        <button data-motion="seated">坐地</button><button id="spine-pause">暫停動畫</button>
      </div><p id="spine-status" aria-live="polite">準備素材中</p><div id="preview-canvas"></div></main>`;
    const base = `${import.meta.env.BASE_URL}assets/characters/hero/`;
    const assets = { skeleton: `${base}hero.json`, atlas: `${base}hero.atlas` };
    await Assets.load([assets.skeleton, assets.atlas], onProgress);
    if (this.disposed) {
      return;
    }
    await this.app.init({ width: 1152, height: 540, background: 0x233b32, antialias: true });
    if (this.disposed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = 'auto';
    this.app.canvas.setAttribute('aria-label', 'Spine 角色即時換裝與動畫');
    document.querySelector('#preview-canvas')!.appendChild(this.app.canvas);
    this.actor = new SpineHero(assets);
    this.actor.position.set(576, 490);
    this.actor.scale.set(1.15);
    this.app.stage.addChild(this.actor);
    this.app.ticker.add((ticker) => {
      if (!this.paused && !document.hidden) {
        this.actor?.update(Math.min(ticker.deltaMS / 1000, 0.05));
      }
    });
    this.bindControls();
    this.showStatus('待機');
  }

  dispose(): void {
    this.disposed = true;
    this.lifetime.abort();
    if (this.app.renderer) {
      this.app.destroy(true, { children: true });
    }
    // 紋理與骨架由 Pixi Assets 快取共用，不能隨單一角色銷毀。
  }

  private bindControls(): void {
    const options = { signal: this.lifetime.signal };
    for (const id of ['spine-outfit', 'spine-hair', 'spine-weapon']) {
      document
        .getElementById(id)!
        .addEventListener('change', () => this.changeAppearance(), options);
    }
    const injury = document.querySelector<HTMLInputElement>('#spine-injury')!;
    injury.addEventListener(
      'change',
      () => {
        this.actor?.setRightArmInjured(injury.checked);
        this.showStatus(injury.checked ? '右手失能，使用左手動作' : '雙手正常');
      },
      options,
    );
    document.querySelector('#spine-motions')!.addEventListener(
      'click',
      (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-motion]');
        const motion = button?.dataset.motion;
        if (motion && ['idle', 'walk', 'attack', 'hurt', 'seated'].includes(motion)) {
          this.actor?.playMotion(motion as HeroMotion);
          this.showStatus(button!.textContent ?? motion);
        }
      },
      options,
    );
    const pause = document.querySelector<HTMLButtonElement>('#spine-pause')!;
    pause.addEventListener(
      'click',
      () => {
        this.paused = !this.paused;
        pause.textContent = this.paused ? '繼續動畫' : '暫停動畫';
      },
      options,
    );
  }

  private changeAppearance(): void {
    const get = (id: string) => document.querySelector<HTMLSelectElement>(`#${id}`)!.value;
    this.actor?.setAppearance({
      outfit: get('spine-outfit') as HeroAppearance['outfit'],
      hair: get('spine-hair') as HeroAppearance['hair'],
      weapon: get('spine-weapon') as HeroAppearance['weapon'],
    });
    this.showStatus('外觀已更新');
  }

  private showStatus(message: string): void {
    document.querySelector('#spine-status')!.textContent = message;
  }
}
