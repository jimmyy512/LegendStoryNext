import { Container, Graphics } from 'pixi.js';
import type { Battle } from '../../game/battle';
import { battleOutcome } from '../../game/battleOutcome';
import { control, healthBar, label } from './widgets';

/** The combat dock becomes a settlement view, leaving the fighters and arena visible. */
export function battleOutcomeSheet(
  battle: Battle,
  width: number,
  height: number,
  press: (action: string) => void,
): Container {
  const root = new Container();
  const narrow = width < 620 && height > 220;
  const compact = height < 200;
  const contentWidth = Math.min(1120, width - 32);
  const start = (width - contentWidth) / 2;
  const summary = battleOutcome(battle);
  root.addChild(
    new Graphics().rect(0, 0, width, height).fill(0x10231f).rect(0, 0, width, 2).fill(0xb79a5d),
  );
  const put = (text: string, x: number, y: number, size: number, w: number, color = 0xeee4ca) => {
    const item = label(text, { size, width: w, color });
    item.position.set(start + x, y);
    root.addChild(item);
    return item;
  };
  const leftWidth = narrow ? contentWidth : contentWidth * 0.48;
  const rightX = narrow ? 0 : contentWidth * 0.54;
  const rightWidth = narrow ? contentWidth : contentWidth - rightX;
  put(
    summary.title,
    0,
    compact ? 10 : 16,
    compact ? 21 : 27,
    contentWidth,
    0xe9c783,
  ).style.fontFamily = '"Noto Serif TC", "PMingLiU", serif';
  put(summary.rewards, 0, compact ? 45 : 58, narrow ? 20 : compact ? 17 : 22, leftWidth, 0xe9c783);
  put(summary.growth, 0, compact ? 76 : 98, compact ? 12 : 14, leftWidth, 0xbccfc1);
  const progress = healthBar({
    width: leftWidth,
    value: summary.progress,
    max: 1,
    color: 0x83c5ad,
  });
  progress.position.set(start, compact ? 102 : 127);
  root.addChild(progress);
  if (summary.loot) {
    put(summary.loot, 0, compact ? 113 : 137, compact ? 12 : 14, leftWidth);
  }
  put(
    summary.condition,
    rightX,
    narrow ? 163 : compact ? 47 : 59,
    compact ? 12 : 15,
    rightWidth,
    0xd1c9ae,
  );
  put(
    summary.next,
    rightX,
    narrow ? 220 : compact ? 92 : 112,
    compact ? 12 : 16,
    rightWidth,
    0x9ccebb,
  );
  const buttonWidth = narrow ? contentWidth : Math.min(300, rightWidth);
  const button = control({
    label: summary.action,
    action: 'battle-end',
    width: buttonWidth,
    height: 46,
    primary: true,
    press,
  });
  button.position.set(start + contentWidth - buttonWidth, height - 60);
  root.addChild(button);
  return root;
}
