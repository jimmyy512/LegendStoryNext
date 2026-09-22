import { Input } from '@pixi/ui';
import type { DestroyOptions } from 'pixi.js';

/** 直接同步原生欄位的完整值，保留中文組字、選取取代與貼上行為。 */
export class NameInput extends Input {
  protected createInputField(): void {
    super.createInputField();
    if (!this.input) {
      return;
    }
    this.input.value = this.value;
    this.input.maxLength = 12;
    this.input.setAttribute('aria-label', '俠客姓名');
    this.input.style.fontSize = '18px';
    this.input.select();
  }

  protected onInput(event: InputEvent): void {
    if (!this.input) {
      return;
    }
    this.value = event.isComposing ? this.input.value : this.input.value.slice(0, 12);
    this.onChange.emit(this.value);
  }

  protected onKeyUp(event: KeyboardEvent): void {
    if (!event.isComposing && (event.key === 'Enter' || event.key === 'Escape')) {
      this.stopEditing();
    }
  }

  protected onPaste(): void {
    // 讓原生欄位處理游標與選取範圍，結果由 input 事件同步。
  }

  destroy(options?: DestroyOptions | boolean): void {
    this.stopEditing();
    super.destroy(options);
  }
}
