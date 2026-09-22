import 'pixi.js/accessibility';
import { ButtonContainer } from '@pixi/ui';
import { Container, Graphics, Text } from 'pixi.js';

export function clear(container: Container): void {
  for (const child of container.removeChildren()) {
    child.destroy({ children: true });
  }
}

export function label(
  value: string,
  options: { size?: number; width?: number; color?: number } = {},
): Text {
  return new Text({
    text: value,
    style: {
      fontFamily: '"Noto Sans TC", sans-serif',
      fontSize: options.size ?? 14,
      fill: options.color ?? 0xeee4ca,
      wordWrap: !!options.width,
      wordWrapWidth: options.width,
      breakWords: true,
      lineHeight: (options.size ?? 14) * 1.5,
    },
  });
}

export function surface(width: number, height: number): Graphics {
  return new Graphics()
    .roundRect(0, 0, width, height, 10)
    .fill({ color: 0x142c29, alpha: 0.88 })
    .stroke({ color: 0xcdb27b, alpha: 0.55, width: 1 });
}

export function control(options: {
  label: string;
  action: string;
  width: number;
  height?: number;
  disabled?: boolean;
  selected?: boolean;
  press: (action: string) => void;
}): ButtonContainer {
  const height = options.height ?? 44;
  const button = new ButtonContainer(surface(options.width, height));
  button.label = options.action;
  button.enabled = !options.disabled;
  button.accessible = !options.disabled;
  button.accessibleTitle = options.label;
  button.accessibleHint = options.label;
  button.tabIndex = 0;
  button.alpha = options.disabled ? 0.4 : 1;
  button.cursor = options.disabled ? 'default' : 'pointer';
  const title = label(options.label, {
    size: 13,
    width: options.width - 12,
    color: options.selected ? 0xffd786 : 0xeee4ca,
  });
  title.anchor.set(0.5);
  title.position.set(options.width / 2, height / 2);
  button.addChild(title);
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
  bar.addChild(new Graphics().roundRect(0, 0, options.width, 5, 2).fill(0x071b19));
  bar.addChild(new Graphics().roundRect(0, 0, options.width * amount, 5, 2).fill(options.color));
  return bar;
}
