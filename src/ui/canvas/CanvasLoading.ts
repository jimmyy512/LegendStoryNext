import { Container } from 'pixi.js';
import type { TransitionView } from '../../core/TransitionController';
import { action, paragraph } from './model';
import { PanelOverlay } from './PanelOverlay';

export class CanvasLoading implements TransitionView {
  private panel: PanelOverlay;
  private resolveRetry: ((retry: boolean) => void) | null = null;
  constructor(root: Container) {
    this.panel = new PanelOverlay((action) => {
      this.resolveRetry?.(action === 'retry');
      this.resolveRetry = null;
    });
    root.addChild(this.panel.root);
  }

  resize(width: number, height: number): void {
    this.panel.resize(width, height);
  }

  show(message: string, progress: number | null = null): void {
    this.panel.show({
      title: message,
      dismissible: false,
      rows: [
        paragraph(progress === null ? '正在準備畫卷…' : `載入 ${Math.round(progress * 100)}%`),
      ],
    });
  }

  askRetry(error: unknown, cancellable: boolean): Promise<boolean> {
    this.panel.show({
      title: '畫卷暫時無法展開',
      dismissible: false,
      rows: [
        paragraph(error instanceof Error ? error.message : '載入失敗，請確認網路後重試。'),
        action('重新載入', 'retry'),
        ...(cancellable ? [action('返回原畫面', 'cancel')] : []),
      ],
    });
    return new Promise((resolve) => {
      this.resolveRetry = resolve;
    });
  }

  hide(): void {
    this.panel.hide();
  }
}
