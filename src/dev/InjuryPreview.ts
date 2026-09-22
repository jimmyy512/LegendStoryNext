import { Application, Container, Graphics, Text } from 'pixi.js';
import { SKILLS } from '../data/content';
import { createBody, limbPower, mobility, movementRate } from '../game/body';
import { CombatantSprite } from '../render/CombatantSprite';
import { bodyPanel } from '../ui/bodyPanel';

/** 獨立驗收頁，不建立旅程、不讀寫存檔，與遊戲使用同一個角色繪製類別。 */
export class InjuryPreview {
  private app = new Application();
  private body = createBody();
  private actor: CombatantSprite | null = null;
  private moving = false;
  private elapsed = 0;
  private lifetime = new AbortController();

  async init(): Promise<void> {
    document.querySelector('#app')!.innerHTML = `
      <main class="injury-preview"><a href="./">← 返回口袋江湖</a>
      <p class="eyebrow">非血腥部位傷勢 · 原型驗收</p><h1>傷勢演武</h1>
      <p>此頁不影響旅程與存檔。角色繪製和能力計算皆與遊戲共用。</p>
      <div class="preview-controls"><button data-pose="healthy">完整狀態</button><button data-pose="right-arm">右手失能</button><button data-pose="both-arms">雙手失能</button><button data-pose="one-leg">右腿失能</button><button data-pose="both-legs">雙腿失能</button><button data-pose="move">切換移動／靜止</button></div>
      <div id="preview-canvas"></div><div id="preview-report"></div></main>`;
    await this.app.init({
      width: 1152,
      height: 400,
      antialias: true,
      background: 0x233b32,
      resolution: 2,
      autoDensity: true,
    });
    document.querySelector('#preview-canvas')!.appendChild(this.app.canvas);
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = 'auto';
    this.app.canvas.setAttribute('aria-label', '角色傷勢姿態預覽');
    document.querySelector('.preview-controls')!.addEventListener(
      'click',
      (event) => {
        const mode = (event.target as HTMLElement).closest<HTMLElement>('[data-pose]')?.dataset
          .pose;
        if (!mode) {
          return;
        }
        if (mode === 'move') {
          this.moving = !this.moving;
        } else {
          this.body = createBody();
          if (mode === 'right-arm' || mode === 'both-arms') {
            this.body.rightArm = 0;
          }
          if (mode === 'both-arms') {
            this.body.leftArm = 0;
          }
          if (mode === 'one-leg' || mode === 'both-legs') {
            this.body.rightLeg = 0;
          }
          if (mode === 'both-legs') {
            this.body.leftLeg = 0;
          }
        }
        this.render();
      },
      { signal: this.lifetime.signal },
    );
    this.app.ticker.add((ticker) => {
      this.elapsed += Math.min(ticker.deltaMS / 1000, 0.05);
      this.actor?.setMoving(this.moving, this.elapsed);
      if (this.actor) {
        this.actor.x =
          576 + (this.moving ? Math.sin(this.elapsed * movementRate(this.body)) * 160 : 0);
      }
    });
    this.render();
  }

  dispose(): void {
    this.lifetime.abort();
    this.app.destroy(true, { children: true });
  }

  private render(): void {
    for (const node of this.app.stage.removeChildren()) {
      node.destroy({ children: true });
    }
    const stage = new Container();
    stage.addChild(
      new Graphics().ellipse(576, 330, 410, 35).fill({ color: 0xc6c5a2, alpha: 0.08 }),
    );
    this.actor = new CombatantSprite(0xcac4a1, this.body, true);
    this.actor.scale.set(4.5);
    this.actor.position.set(576, 315);
    this.actor.setMoving(this.moving, this.elapsed);
    stage.addChild(this.actor);
    const pose = { standing: '站立', limping: '跛行', seated: '坐地', crawling: '爬行' }[
      mobility(this.body, this.moving)
    ];
    const label = new Text({
      text: pose,
      style: { fill: 0xe0d4b2, fontSize: 24, fontFamily: 'serif' },
    });
    label.anchor.set(0.5);
    label.position.set(576, 365);
    stage.addChild(label);
    this.app.stage.addChild(stage);
    document.querySelector('#preview-report')!.innerHTML = `
      <h2>目前姿態：${pose} · 移速 ${Math.round(movementRate(this.body) * 100)}%</h2>
      <div class="preview-report-grid">${bodyPanel(this.body)}<div>${SKILLS.sword.map((skill) => `<p>${skill.name} · ${skill.limbs.hands === 2 ? '雙手招式' : '單手招式'} · 威力 ${Math.round(limbPower(this.body, skill.limbs) * 100)}%</p>`).join('')}<p>傷肢仍完整保留，以垂手、繃帶、坐姿和爬姿表現功能喪失。</p></div></div>`;
  }
}
