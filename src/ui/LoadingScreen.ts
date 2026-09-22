import type { TransitionView } from '../core/TransitionController';
/** 引擎尚未下載時也能顯示，不能依賴 Pixi 或遊戲模組。 */
export class LoadingScreen {
  private canvas: TransitionView | null = null;
  private element = document.createElement('div');
  private lastFocus: HTMLElement | null = null;

  constructor() {
    this.element.className = 'loading-screen';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', '載入江湖');
    document.body.appendChild(this.element);
  }

  attach(canvas: TransitionView): void {
    this.hide();
    this.canvas = canvas;
  }

  show(message: string, progress: number | null = null): void {
    if (this.canvas) {
      this.canvas.show(message, progress);
      return;
    }
    if (this.element.hidden) {
      this.lastFocus = document.activeElement as HTMLElement;
    }
    document.querySelector<HTMLElement>('#app')?.setAttribute('inert', '');
    this.element.hidden = false;
    this.element.innerHTML =
      '<section class="loading-card"><span class="seal">俠</span><h2></h2><progress max="100" aria-label="資源載入進度"></progress><p></p><div class="loading-actions"></div></section>';
    this.element.querySelector('h2')!.textContent = message;
    const bar = this.element.querySelector('progress')!;
    if (progress !== null) {
      bar.value = Math.round(progress * 100);
    }
    this.element.querySelector('p')!.textContent =
      progress === null ? '正在準備畫卷…' : `資源載入 ${Math.round(progress * 100)}%`;
  }

  async askRetry(error: unknown, cancellable: boolean): Promise<boolean> {
    if (this.canvas) {
      return this.canvas.askRetry(error, cancellable);
    }
    this.element.querySelector('h2')!.textContent = '畫卷暫時無法展開';
    this.element.querySelector('p')!.textContent =
      error instanceof Error ? error.message : '載入失敗，請確認網路後重試。';
    const actions = this.element.querySelector('.loading-actions')!;
    actions.innerHTML =
      '<button class="primary">重新載入</button>' +
      (cancellable ? '<button>返回原畫面</button>' : '');
    const buttons = actions.querySelectorAll('button');
    buttons[0].focus();
    return new Promise((resolve) => {
      buttons[0].addEventListener('click', () => resolve(true), { once: true });
      buttons[1]?.addEventListener('click', () => resolve(false), { once: true });
    });
  }

  hide(): void {
    this.canvas?.hide();
    this.element.hidden = true;
    document.querySelector<HTMLElement>('#app')?.removeAttribute('inert');
    if (this.lastFocus?.isConnected) {
      this.lastFocus.focus();
    }
  }
}
