import { Assets } from 'pixi.js';
import { ComparisonStage } from './ComparisonStage';
import { PALM_DURATION, palmPhase } from './comparisonTiming';
import './styleComparison.css';

export class StyleComparison {
  private stages = [new ComparisonStage(false), new ComparisonStage(true)];
  private lifetime = new AbortController();
  private time = 0;
  private speed = 1;
  private playing = true;
  private looping = true;
  private frame = 0;
  private lastTime = 0;
  private disposed = false;

  async init(onProgress: (progress: number) => void): Promise<void> {
    document.querySelector('#app')!.innerHTML = `
      <main class="style-lab">
        <header class="lab-header"><a href="./">← 口袋江湖</a><span>ART DIRECTION / 01</span></header>
        <div class="lab-intro"><p class="eyebrow">一式兩相 · 美術動態比較</p><h1>降龍十八掌</h1><p>同一位女俠，同一段出掌節奏。比較骨骼的流暢與像素逐格的力度。</p></div>
        <div class="lab-controls"><button id="compare-replay" class="primary">同步施展</button><button id="compare-pause">暫停</button><label>速度 <select id="compare-speed"><option value="1">1× 正常</option><option value="0.5">0.5× 慢動作</option><option value="0.25">0.25× 逐招看</option></select></label><label><input type="checkbox" id="compare-loop" checked> 循環播放</label></div>
        <section class="lab-grid">
          <article class="lab-card"><div class="lab-card-title"><span>甲</span><div><h2>Q 版 · Spine 骨骼</h2><p>分件人物 / 連續插值 / 動態換裝可擴充</p></div></div><div class="lab-canvas" id="compare-spine"></div><p class="lab-caption">女俠以骨架蓄力、推掌、收勢，馬尾跟隨動作。服裝、手臂與髮型保留獨立部件。</p></article>
          <article class="lab-card"><div class="lab-card-title"><span>乙</span><div><h2>像素 · 八格動畫</h2><p>固定服裝 / 逐格姿勢 / 低解析度特效</p></div></div><div class="lab-canvas pixel-canvas" id="compare-pixel"></div><p class="lab-caption">女俠使用八張實際姿勢圖切換，金龍與場景以低解析度呈現，不只是把 Spine 畫面套濾鏡。</p></article>
        </section>
        <section class="lab-timeline"><div><strong id="compare-phase">起式</strong><span id="compare-time">0.00 / 2.80 秒</span></div><label for="compare-scrub">拖曳時間軸，停在同一刻比較</label><input id="compare-scrub" type="range" min="0" max="2.8" step="0.01" value="0"></section>
        <footer class="lab-notes"><p>兩版均站在原地，不影響遊戲進度。這是美術動態樣片，並非十八套完整招式。角色素材為 AI 產生後分件／編排，金龍沿用你的舊作素材。像素龍目前是低解析度呈現，尚非另外逐格精繪。</p><p>像素也能換裝：需要分層繪製各姿勢的服裝與武器。本樣片先固定服裝，方便比較風格，並未排除未來的換裝功能。</p></footer>
      </main>`;
    const base = `${import.meta.env.BASE_URL}assets/styleComparison/`;
    await Assets.load(
      ['heroine.json', 'heroine.atlas', 'heroine-pixel.png', 'dragon.png'].map(
        (name) => `${base}${name}`,
      ),
      onProgress,
    );
    if (this.disposed) {
      return;
    }
    await Promise.all(
      this.stages.map((stage, index) =>
        stage.init(
          document.querySelector<HTMLElement>(index ? '#compare-pixel' : '#compare-spine')!,
          base,
        ),
      ),
    );
    if (this.disposed) {
      return;
    }
    this.bindControls();
    this.frame = requestAnimationFrame(this.tick);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.lifetime.abort();
    for (const stage of this.stages) {
      stage.dispose();
    }
  }

  private tick = (now: number): void => {
    const delta = this.lastTime ? Math.min(0.05, (now - this.lastTime) / 1000) : 0;
    this.lastTime = now;
    if (this.playing && !document.hidden) {
      this.time += delta * this.speed;
      if (this.time >= PALM_DURATION) {
        this.time = this.looping ? this.time % PALM_DURATION : PALM_DURATION;
        this.playing = this.looping;
      }
    }
    this.render();
    this.frame = requestAnimationFrame(this.tick);
  };

  private render(): void {
    for (const stage of this.stages) {
      stage.render(this.time);
    }
    document.querySelector('#compare-phase')!.textContent = palmPhase(this.time);
    document.querySelector('#compare-time')!.textContent = `${this.time.toFixed(2)} / 2.80 秒`;
    document.querySelector<HTMLButtonElement>('#compare-pause')!.textContent = this.playing
      ? '暫停'
      : '繼續';
    document.querySelector<HTMLInputElement>('#compare-scrub')!.value = String(this.time);
  }

  private bindControls(): void {
    const options = { signal: this.lifetime.signal };
    document.querySelector('#compare-replay')!.addEventListener(
      'click',
      () => {
        this.time = 0;
        this.playing = true;
      },
      options,
    );
    document.querySelector('#compare-pause')!.addEventListener(
      'click',
      () => {
        if (this.time === PALM_DURATION) {
          this.time = 0;
        }
        this.playing = !this.playing;
      },
      options,
    );
    document.querySelector('#compare-speed')!.addEventListener(
      'change',
      (event) => {
        this.speed = Number((event.target as HTMLSelectElement).value);
      },
      options,
    );
    document.querySelector('#compare-loop')!.addEventListener(
      'change',
      (event) => {
        this.looping = (event.target as HTMLInputElement).checked;
      },
      options,
    );
    document.querySelector('#compare-scrub')!.addEventListener(
      'input',
      (event) => {
        this.playing = false;
        this.time = Number((event.target as HTMLInputElement).value);
        this.render();
      },
      options,
    );
  }
}
