/** 固定步長讓規則不依賴畫面幀率。背景分頁由應用層暫停，不補算離線傷害。 */
export class CombatClock {
  private remainder = 0;
  elapsed = 0;

  advance(seconds: number, step: (dt: number) => boolean): void {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }
    this.remainder += seconds;
    while (this.remainder + 1e-9 >= 0.05) {
      this.remainder -= 0.05;
      this.elapsed += 0.05;
      if (!step(0.05)) {
        this.remainder = 0;
        break;
      }
    }
  }
}
