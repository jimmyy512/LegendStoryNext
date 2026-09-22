export interface TransitionView {
  show(message: string, progress?: number | null): void;
  askRetry(error: unknown, cancellable: boolean): Promise<boolean>;
  hide(): void;
}

/** 換場景的鎖與重試在同一層管理，失敗時不執行 commit。 */
export class TransitionController {
  private running = false;

  constructor(private readonly view: TransitionView) {}

  get busy(): boolean {
    return this.running;
  }

  async run(options: {
    label: string;
    prepare: (progress: (value: number) => void) => Promise<void>;
    commit: () => void;
    afterCommit?: () => Promise<void>;
    cancellable?: boolean;
  }): Promise<boolean> {
    if (this.running) {
      return false;
    }
    this.running = true;
    try {
      while (true) {
        this.view.show(options.label);
        try {
          await options.prepare((value) => this.view.show(options.label, value));
        } catch (error) {
          if (await this.view.askRetry(error, options.cancellable ?? true)) {
            continue;
          }
          return false;
        }
        options.commit();
        await options.afterCommit?.();
        return true;
      }
    } finally {
      this.running = false;
      this.view.hide();
    }
  }
}
