import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { createGame, useMedicine } from '../src/game/state';
import { PanelView } from '../src/ui/PanelView';
import {
  combatGuidePanel,
  creationPanel,
  dialoguePanel,
  endingPanel,
  medicinePanel,
} from '../src/ui/canvas/storyPanels';

const options = { saveSlots: [], reducedMotion: false, audioVolume: 0.25 };
describe('Pixi 遊戲面板保留操作規則', () => {
  it('章末只接續已接取且未完成的支線，不把未知或已完成任務再當目標', () => {
    const state = createGame('旅人', 'fist');
    state.quest = 'complete';
    const guides = () =>
      endingPanel(state).rows.filter(
        (row) => row.kind === 'action' && row.action.startsWith('guide:'),
      );
    expect(guides()).toEqual([]);
    state.flags.push('wine-quest');
    expect(guides()).toEqual([expect.objectContaining({ action: 'guide:wine' })]);
    state.flags.push('wine-done');
    expect(guides()).toEqual([]);
    state.inventory.flower = 1;
    expect(guides()).toEqual([expect.objectContaining({ action: 'guide:herb' })]);
  });
  it('行囊滿血藥品停用，受傷後可使用，且物品操作留在各自詳情內', () => {
    const state = createGame('旅人', 'sword');
    const panels = new PanelView();
    const item = () =>
      panels.render(state, 'bag', options).sections!.find((section) => section.id === 'herb')!;
    expect(item().rows.find((row) => row.kind === 'action')).toMatchObject({
      action: 'use:herb',
      disabled: true,
    });
    state.hp -= 30;
    state.body.head -= 8;
    expect(item().rows.find((row) => row.kind === 'action')).toMatchObject({
      action: 'use:herb',
      disabled: false,
    });
    const treated = structuredClone(state);
    useMedicine(treated, 'herb');
    expect(item().rows).toContainEqual({
      kind: 'text',
      text: `使用後：生命 ${state.hp} → ${treated.hp}`,
    });
    expect(treated.body.head).toBe(state.body.head);
    expect(item().rows).toContainEqual({
      kind: 'text',
      text: '藥品只恢復生命或內力。\n部位傷勢請回門派休息療養。',
    });
    state.inventory.herb = 0;
    expect(item()).toBeUndefined();
  });

  it('角色預覽使用目前裝備與髮型，武學頁提供每個招式的美術圖示', () => {
    const state = createGame('旅人', 'fist');
    const panel = new PanelView().render(state, 'character', options);
    expect(panel.hero).toBe(state);
    expect(
      panel
        .sections!.find((section) => section.id === 'skills')!
        .rows.filter((row) => row.kind === 'text' && row.icon),
    ).toEqual([
      expect.objectContaining({ icon: 'skill-icon:guard' }),
      expect.objectContaining({ icon: 'skill-icon:dragon' }),
    ]);
  });

  it('衣冠只提供髮型，斗笠由獨立頭飾裝備管理', () => {
    const state = createGame('旅人', 'sword');
    state.hair = 'Hair3';
    const rows = new PanelView()
      .render(state, 'character', options)
      .sections!.find((section) => section.id === 'look')!.rows;
    expect(rows.filter((row) => row.kind === 'action')).toEqual([
      expect.objectContaining({ label: '束髮', action: 'hair:Hair1', selected: true }),
      expect.objectContaining({ label: '髮髻', action: 'hair:Hair2' }),
    ]);
    expect(state.hair).toBe('Hair3');
  });
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

  it('交鋒說明依武器與對手寫出實際射程，文案不使用分號', () => {
    const sword = combatGuidePanel(new Battle(createGame('旅人', 'sword'), 'patrol'));
    const fist = combatGuidePanel(new Battle(createGame('旅人', 'fist'), 'patrol'));
    const text = (panel: typeof sword) =>
      panel.rows.map((row) => ('text' in row ? row.text : '')).join(' ');
    expect(text(sword)).toContain('你的射程是 2～5');
    expect(text(fist)).toContain('你的射程是 1～3');
    expect(text(sword)).not.toMatch(/[;；]/);
    expect(sword.rows.at(-1)).toMatchObject({ kind: 'action', action: 'battle-help-close' });
  });
});
