import { Container, Graphics } from 'pixi.js';
import { control, label } from './widgets';

/** Full-screen defeat presentation, after the fighter has finished falling. */
export function defeatScreen(
  width: number,
  height: number,
  checkpoint: string,
  available: boolean,
  press: (action: string) => void,
): Container {
  const root = new Container();
  root.eventMode = 'static';
  root.addChild(new Graphics().rect(0, 0, width, height).fill({ color: 0x100e10, alpha: 0.92 }));
  const center = width / 2;
  const content = Math.min(620, width - 48);
  const compact = height < 520;
  const top = Math.max(28, height * 0.2);
  // A vermilion seal and restrained gold keep the same ink-and-jade game palette.
  const seal = new Graphics().roundRect(-26, -26, 52, 52, 3).fill(0x863b31);
  seal.position.set(center, top);
  root.addChild(seal);
  const put = (text: string, y: number, size: number, color: number) => {
    const node = label(text, { width: content, size, color, family: '"Noto Serif TC", serif' });
    node.style.align = 'center';
    node.anchor.set(0.5, 0);
    node.position.set(center, y);
    root.addChild(node);
  };
  put('敗', top - 18, 28, 0xf1d8b5);
  put('勝敗乃兵家常事', top + 48, Math.min(54, (width - 48) / 8), 0xe6d5b3);
  put('大俠，歇一歇，再闖江湖。', top + (compact ? 98 : 130), 18, 0xb7aaa0);
  put(checkpoint, top + (compact ? 139 : 192), 14, 0xc7b996);
  const button = control({
    label: available ? '讀取最近存檔' : '返回主選單',
    action: available ? 'defeat-load' : 'defeat-home',
    width: Math.min(300, content),
    height: 54,
    primary: true,
    press,
  });
  button.position.set(
    center - button.width / 2,
    Math.min(height - 80, top + (compact ? 197 : 282)),
  );
  root.addChild(button);
  return root;
}
