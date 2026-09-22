export interface Scene {
  update(dt: number): void;
  dispose(): void;
}

/** 建立新場景失敗時保留舊場景，成功後才釋放原本的事件與顯示物件。 */
export class SceneManager<T extends Scene> {
  private current: T | null = null;

  replace(create: () => T): T {
    const next = create();
    const previous = this.current;
    this.current = next;
    previous?.dispose();
    return next;
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  dispose(): void {
    this.current?.dispose();
    this.current = null;
  }
}
