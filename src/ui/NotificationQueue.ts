/** One message completes its entrance, reading time and exit before the next starts. */
export class NotificationQueue {
  private pending: string[] = [];
  current: string | null = null;
  elapsed = 0;
  readonly entrance = 0.3;
  readonly exit = 0.25;
  hold = 3.2;

  enqueue(message: string): void {
    if (message === this.current || message === this.pending.at(-1)) {
      return;
    }
    this.pending.push(message);
    this.advance();
  }

  update(seconds: number): void {
    if (!this.current) {
      return;
    }
    this.elapsed += Math.max(0, seconds);
    if (this.elapsed >= this.entrance + this.hold + this.exit) {
      this.current = null;
      this.advance();
    }
  }

  private advance(): void {
    if (!this.current && this.pending.length) {
      this.current = this.pending.shift()!;
      this.elapsed = 0;
      this.hold = Math.min(7, Math.max(3.2, this.current.length * 0.085));
    }
  }
}
