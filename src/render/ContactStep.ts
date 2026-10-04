/** Short authored attack approach, independent of simulation positions/range. */
export class ContactStep {
  x = 0;
  y = 0;
  private dx = 0;
  private dy = 0;
  private fromX = 0;
  private fromY = 0;
  private elapsed = 0;
  private duration = 0;
  private returning = false;
  private active = false;

  get destination(): { x: number; y: number } {
    return this.returning ? { x: this.x, y: this.y } : { x: this.dx, y: this.dy };
  }

  start(dx: number, dy: number, duration: number): void {
    this.fromX = this.x;
    this.fromY = this.y;
    this.dx = dx;
    this.dy = dy;
    this.elapsed = 0;
    this.duration = duration;
    this.returning = false;
    this.active = true;
  }

  strike(): void {
    if (!this.active || this.returning) {
      return;
    }
    this.x = this.dx;
    this.y = this.dy;
    this.elapsed = 0;
    this.returning = true;
  }

  cancel(): void {
    this.dx = this.x;
    this.dy = this.y;
    this.elapsed = 0;
    this.returning = true;
  }

  update(dt: number, holdReturn = false): void {
    if (this.returning && holdReturn) {
      return;
    }
    this.elapsed += dt;
    const t = this.returning
      ? Math.min(1, Math.max(0, this.elapsed - 0.08) / 0.32)
      : Math.min(1, this.elapsed / Math.max(0.01, this.duration * 0.9));
    const smooth = t * t * (3 - 2 * t);
    this.x = this.returning ? this.dx * (1 - smooth) : this.fromX + (this.dx - this.fromX) * smooth;
    this.y = this.returning ? this.dy * (1 - smooth) : this.fromY + (this.dy - this.fromY) * smooth;
    if (this.returning && t === 1) {
      this.active = false;
    }
  }
}
