import 'pixi.js/accessibility';
import { ButtonContainer } from '@pixi/ui';
import { Container, Graphics, Text } from 'pixi.js';

export function clear(container: Container): void {
  for (const child of container.removeChildren()) {
    child.destroy({ children: true });
  }
}

/** Pixi 8.21 只在建立代理按鈕時寫入標籤，動態狀態需同步既有代理。 */
export function accessibleLabel(container: Container, text: string): void {
  container.accessibleTitle = text;
  const proxy = container._accessibleDiv;
  if (proxy && proxy.title !== text) {
    proxy.title = text;
    proxy.setAttribute('aria-label', text);
  }
}

export function label(
  value: string,
  options: { size?: number; width?: number; color?: number; family?: string } = {},
): Text {
  return new Text({
    text: value,
    style: {
      fontFamily: options.family ?? '"Noto Sans TC", sans-serif',
      fontSize: options.size ?? 14,
      fill: options.color ?? 0xeee4ca,
      wordWrap: !!options.width,
      wordWrapWidth: options.width,
      breakWords: true,
      lineHeight: (options.size ?? 14) * 1.5,
    },
  });
}

/** 像素風木牌／銅邊：所有正式操作都由 Pixi Graphics 繪製。 */
export function drawGamePlate(
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { primary?: boolean; active?: boolean; alpha?: number } = {},
): Graphics {
  const cut = Math.min(7, Math.max(3, Math.floor(Math.min(width, height) / 7)));
  const primary = options.primary ?? false;
  const active = options.active ?? false;
  const border = primary || active ? 0xe8c983 : 0x789182;
  const fill = primary ? 0xb99b60 : active ? 0x315249 : 0x142b27;
  graphics
    .moveTo(x + cut, y)
    .lineTo(x + width - cut, y)
    .lineTo(x + width, y + cut)
    .lineTo(x + width, y + height - cut)
    .lineTo(x + width - cut, y + height)
    .lineTo(x + cut, y + height)
    .lineTo(x, y + height - cut)
    .lineTo(x, y + cut)
    .closePath()
    .fill({ color: fill, alpha: options.alpha ?? 0.96 })
    .stroke({
      color: border,
      alpha: primary || active ? 1 : 0.82,
      width: primary || active ? 2 : 1,
    });
  if (width > 42 && height > 24) {
    graphics
      .moveTo(x + cut + 4, y + 4)
      .lineTo(x + width - cut - 4, y + 4)
      .stroke({ color: primary ? 0xf8e0a0 : 0x57756a, alpha: 0.65, width: 1 });
    graphics.rect(x + cut + 4, y + height - 5, 10, 2).fill({ color: border, alpha: 0.7 });
    graphics.rect(x + width - cut - 14, y + height - 5, 10, 2).fill({ color: border, alpha: 0.7 });
  }
  return graphics;
}

export function surface(width: number, height: number): Graphics {
  return drawGamePlate(new Graphics(), 0, 0, width, height, { alpha: 0.92 });
}

export function control(options: {
  label: string;
  action: string;
  width: number;
  height?: number;
  disabled?: boolean;
  selected?: boolean;
  primary?: boolean;
  press: (action: string) => void;
}): ButtonContainer {
  const height = options.height ?? 44;
  const background = drawGamePlate(new Graphics(), 0, 0, options.width, height, {
    primary: options.primary,
    active: options.selected,
  });
  const button = new ButtonContainer(background);
  button.label = options.action;
  button.enabled = !options.disabled;
  button.accessible = !options.disabled;
  button.accessibleTitle = options.label;
  button.accessibleHint = options.label;
  button.tabIndex = 0;
  button.alpha = options.disabled ? 0.4 : 1;
  button.cursor = options.disabled ? 'default' : 'pointer';
  const title = label(options.label, {
    size: options.primary ? 16 : 14,
    width: options.width - 12,
    color: options.primary ? 0x13221e : options.selected ? 0xffd786 : 0xeee4ca,
  });
  title.anchor.set(0.5);
  title.position.set(options.width / 2, height / 2);
  button.addChild(title);
  const focus = drawGamePlate(new Graphics(), 0, 0, options.width, height, {
    active: true,
    alpha: 0,
  });
  focus.visible = false;
  focus.eventMode = 'none';
  button.addChild(focus);
  const showFocus = () => {
    focus.visible = !options.disabled;
  };
  const hideFocus = () => {
    focus.visible = false;
  };
  button.on('pointerover', showFocus);
  button.on('pointerout', hideFocus);
  // Pixi accessibility forwards keyboard focus as mouse events.
  button.on('mouseover', showFocus);
  button.on('mouseout', hideFocus);
  button.on('pointertap', (event) => {
    event.stopPropagation();
    if (!options.disabled) {
      options.press(options.action);
    }
  });
  return button;
}

export function healthBar(options: {
  width: number;
  value: number;
  max: number;
  color: number;
}): Container {
  const bar = new Container();
  const amount = Math.max(0, Math.min(1, options.value / options.max));
  bar.addChild(new Graphics().rect(0, 0, options.width, 6).fill(0x071b19));
  bar.addChild(new Graphics().rect(0, 0, options.width * amount, 6).fill(options.color));
  return bar;
}
