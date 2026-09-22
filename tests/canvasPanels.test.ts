import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { createGame } from '../src/game/state';
import { PanelView } from '../src/ui/PanelView';
import { creationPanel, dialoguePanel, medicinePanel } from '../src/ui/canvas/storyPanels';

const options = { saveSlots: [], reducedMotion: false, audioVolume: 0.25 };
describe('Pixi 遊戲面板保留操作規則', () => {
  it('行囊不能裝備不符路線的武器，商店不能賣掉最後一件已裝備物品', () => {
    const state = createGame('旅人', 'sword');
    state.inventory.wraps = 1;
    state.weapon = 'sword';
    state.inventory.sword = 1;
    const panels = new PanelView();
    const bag = panels.render(state, 'bag', options);
    const shop = panels.render(state, 'shop', options);
    expect(
      bag.rows.find((row) => row.kind === 'action' && row.action === 'equip:wraps'),
    ).toMatchObject({ disabled: true });
    expect(
      shop.rows.find((row) => row.kind === 'action' && row.action === 'sell:sword'),
    ).toMatchObject({ disabled: true });
  });

  it('輸入姓名後切換武學，保留原本輸入內容', () => {
    const draft = { name: '無名', route: 'sword' as const };
    const input = creationPanel(draft).rows.find((row) => row.kind === 'input');
    if (input?.kind !== 'input') {
      throw new Error('Missing name input');
    }
    input.change('東方白');
    expect(creationPanel({ ...draft, route: 'fist' }).rows).toContainEqual(
      expect.objectContaining({ kind: 'input', value: '東方白' }),
    );
  });

  it('對話最後一頁才提供選項，且不允許直接關閉跳過', () => {
    const dialogue = {
      speaker: '師兄',
      role: '全真',
      lines: ['先聽完', '選擇吧'],
      choices: [{ label: '接受', action: 'accept-trial' }],
    };
    expect(dialoguePanel(dialogue, 0)).toMatchObject({ dismissible: false });
    expect(dialoguePanel(dialogue, 0).rows).not.toContainEqual(
      expect.objectContaining({ action: 'story:accept-trial' }),
    );
    expect(dialoguePanel(dialogue, 1).rows).toContainEqual(
      expect.objectContaining({ action: 'story:accept-trial' }),
    );
  });

  it('戰鬥沒有的藥品不可點選', () => {
    const state = createGame('旅人', 'sword');
    state.inventory.elixir = 0;
    const battle = new Battle(state, 'patrol');
    expect(
      medicinePanel(battle).rows.find(
        (row) => row.kind === 'action' && row.action === 'battle:item:elixir',
      ),
    ).toMatchObject({ disabled: true });
  });
});
