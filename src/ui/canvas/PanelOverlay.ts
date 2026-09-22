import { type Input, ScrollBox } from '@pixi/ui';
import { Container, Graphics, Rectangle } from 'pixi.js';
import { NameInput } from './NameInput';
import type { GamePanel, PanelRow } from './model';
import { clear, control, label, surface } from './widgets';

/** 所有面板都在 Pixi 內排版，文字輸入由 Pixi Input 接上系統鍵盤。 */
export class PanelOverlay {
  readonly root = new Container();
  private model: GamePanel | null = null;
  private textInput: Input | null = null;
  private width = 0;
  private height = 0;
  constructor(private readonly press: (action: string) => void) {}

  get visible(): boolean {
    return this.model !== null;
  }

  show(model: GamePanel): void {
    this.hide();
    this.model = model;
    this.draw();
  }

  hide(): void {
    this.model = null;
    clear(this.root);
    this.textInput = null;
  }

  resize(width: number, height: number): void {
    // 鍵盤彈出或旋轉時保留 Input，避免重建原生輸入框而中斷中文組字。
    this.textInput?.removeFromParent();
    this.width = width;
    this.height = height;
    this.draw();
  }

  private draw(): void {
    clear(this.root);
    if (!this.model || !this.width) {
      return;
    }
    const shade = new Graphics()
      .rect(0, 0, this.width, this.height)
      .fill({ color: 0x061512, alpha: 0.65 });
    shade.eventMode = 'static';
    this.root.addChild(shade);
    const width = Math.min(660, this.width - 16);
    const height = this.height - 16;
    const panel = new Container();
    panel.position.set((this.width - width) / 2, 8);
    panel.eventMode = 'static';
    panel.hitArea = new Rectangle(0, 0, width, height);
    panel.addChild(surface(width, height));
    this.drawHeader(panel, width);
    this.drawRows(panel, { width, height });
    this.root.addChild(panel);
  }

  private drawHeader(panel: Container, width: number): void {
    const title = label(this.model!.title, { size: 20, width: width - 90 });
    title.position.set(16, 12);
    panel.addChild(title);
    if (this.model!.dismissible !== false) {
      const close = control({ label: '關閉', action: 'close', width: 56, press: this.press });
      close.position.set(width - 66, 8);
      panel.addChild(close);
    }
  }

  private drawRows(panel: Container, size: { width: number; height: number }): void {
    const width = size.width - 32;
    const rows = this.model!.subtitle
      ? [{ kind: 'text' as const, text: this.model!.subtitle }, ...this.model!.rows]
      : this.model!.rows;
    const scroll = new ScrollBox({
      type: 'vertical',
      width,
      height: Math.max(60, size.height - 82),
      elementsMargin: 10,
      globalScroll: false,
      disableEasing: true,
    });
    scroll.position.set(16, 60);
    scroll.addItems(rows.map((row) => this.row(row, width)));
    panel.addChild(scroll);
    const hint = label('上下滑動查看更多', { size: 10, color: 0xa7b29c });
    hint.position.set(16, size.height - 19);
    panel.addChild(hint);
  }

  private row(row: PanelRow, width: number): Container {
    if (row.kind === 'action') {
      const title = label(row.label, { width: width - 16, size: 13 });
      const height = Math.max(44, title.height + 18);
      title.destroy();
      return control({ ...row, width, height, press: this.press });
    }
    if (row.kind === 'input') {
      return this.input(row, width);
    }
    return label(row.text, {
      width,
      size: row.emphasis === 'heading' ? 18 : 14,
      color: row.emphasis === 'muted' ? 0xa7b29c : 0xeee4ca,
    });
  }

  private input(row: Extract<PanelRow, { kind: 'input' }>, width: number): Input {
    if (this.textInput) {
      this.textInput.setSize(width, 48);
      return this.textInput;
    }
    const input = new NameInput({
      bg: surface(width, 48),
      value: row.value,
      maxLength: 12,
      padding: 12,
      textStyle: { fontSize: 18, fill: 0xeee4ca, fontFamily: 'sans-serif' },
    });
    input.label = 'hero-name';
    input.accessible = true;
    input.accessibleHint = '俠客姓名';
    input.tabIndex = 0;
    input.onChange.connect((value) => {
      row.value = value;
      row.change(value);
    });
    this.textInput = input;
    return input;
  }

  dispose(): void {
    this.root.destroy({ children: true });
  }
}
