import { INNER_ARTS, ITEMS, QUESTS, SKILLS } from '../data/content';
import { HAIR_NAMES, HAIR_STYLES } from '../game/appearance';
import { BODY_PARTS, PART_CAPACITY, PART_NAMES, bodyCondition } from '../game/body';
import { getStats } from '../game/state';
import type { GameState, ItemId } from '../game/types';
import { action, heading, paragraph, type GamePanel, type PanelRow } from './canvas/model';

export type Panel = 'character' | 'bag' | 'journal' | 'save' | 'shop' | 'settings';
export interface PanelOptions {
  saveSlots: PanelRow[];
  reducedMotion: boolean;
  audioVolume: number;
}

export function injuryRows(state: GameState): PanelRow[] {
  return BODY_PARTS.map((part) =>
    paragraph(
      `${PART_NAMES[part]} · ${bodyCondition(state.body, part)} · ${state.body[part]}/${PART_CAPACITY[part]}`,
    ),
  );
}

export class PanelView {
  render(state: GameState, panel: Panel, options: PanelOptions): GamePanel {
    switch (panel) {
      case 'character':
        return this.character(state);
      case 'bag':
        return { title: '隨身行囊', rows: this.inventory(state, 'bag') };
      case 'shop':
        return { title: '山門小鋪', rows: this.inventory(state, 'shop') };
      case 'journal':
        return this.journal(state);
      case 'save':
        return {
          title: '存檔與讀檔',
          rows: [
            ...options.saveSlots,
            action('手動存檔', 'save'),
            action('匯出目前進度', 'export'),
            action('匯入備份', 'import'),
            paragraph('進度保留在此瀏覽器，清除網站資料會移除存檔，建議匯出備份。'),
          ],
        };
      case 'settings':
        return this.settings(options);
    }
  }

  private character(state: GameState): GamePanel {
    const stats = getStats(state);
    return {
      title: `${state.name} · 第 ${state.level} 重`,
      rows: [
        heading(INNER_ARTS[state.route].name),
        paragraph(INNER_ARTS[state.route].description),
        paragraph(
          `生命 ${state.hp}/${stats.maxHp} · 內力 ${state.mp}/${stats.maxMp}\n攻擊 ${stats.attack} · 防禦 ${stats.defense} · 身法 ${stats.speed}\n修為 ${state.xp}/${state.level * 60} · 銀兩 ${state.gold}`,
        ),
        paragraph(
          `武器 ${state.weapon ? ITEMS[state.weapon].name : '尚未裝備'} · 防具 ${state.armor ? ITEMS[state.armor].name : '尚未裝備'}`,
        ),
        heading('部位傷勢'),
        ...injuryRows(state),
        heading('所習招式'),
        ...SKILLS[state.route].flatMap((skill) => [
          heading(`${skill.name} · 內力 ${skill.cost}`),
          paragraph(skill.description),
        ]),
        heading('髮型與頭飾'),
        paragraph('只改變外觀，不影響能力。關閉面板即可查看。'),
        ...HAIR_STYLES.map((hair) => ({
          ...action(`${HAIR_NAMES[hair]}${state.hair === hair ? ' · 使用中' : ''}`, `hair:${hair}`),
          disabled: state.hair === hair,
        })),
      ],
    };
  }

  private inventory(state: GameState, mode: 'bag' | 'shop'): PanelRow[] {
    const rows: PanelRow[] = [paragraph(`隨身銀兩 ${state.gold} 兩`)];
    const entries = (Object.entries(ITEMS) as [ItemId, (typeof ITEMS)[ItemId]][]).filter(
      ([id, item]) => (mode === 'shop' ? item.kind !== 'quest' : state.inventory[id] > 0),
    );
    for (const [id, item] of entries) {
      rows.push(heading(`${item.name} ×${state.inventory[id]}`), paragraph(item.description));
      rows.push(...(mode === 'shop' ? this.shopActions(state, id) : this.itemActions(state, id)));
    }
    if (!entries.length) {
      rows.push(paragraph('行囊暫時空著。'));
    }
    return rows;
  }

  private shopActions(state: GameState, id: ItemId): PanelRow[] {
    const item = ITEMS[id];
    const equipped = state.weapon === id || state.armor === id;
    return [
      {
        ...action(`買 ${item.price} 兩`, `buy:${id}`),
        disabled: state.gold < item.price || state.inventory[id] >= 99,
      },
      {
        ...action(`賣 ${Math.floor(item.price / 2)} 兩`, `sell:${id}`),
        disabled: state.inventory[id] <= 0 || (equipped && state.inventory[id] <= 1),
      },
    ];
  }

  private itemActions(state: GameState, id: ItemId): PanelRow[] {
    if (ITEMS[id].kind === 'medicine') {
      return [action('使用', `use:${id}`)];
    }
    if (ITEMS[id].kind === 'quest') {
      return [paragraph('任務物品')];
    }
    const equipped = state.weapon === id || state.armor === id;
    const wrongRoute =
      (id === 'sword' && state.route !== 'sword') || (id === 'wraps' && state.route !== 'fist');
    return [
      {
        ...action(equipped ? '已裝備' : wrongRoute ? '武學不符' : '裝備', `equip:${id}`),
        disabled: equipped || wrongRoute,
      },
    ];
  }

  private journal(state: GameState): GamePanel {
    const quest = QUESTS[state.quest];
    return {
      title: '江湖手札',
      rows: [
        heading(`主線 · ${quest.title}`),
        paragraph(quest.detail),
        heading(`山間一味 · ${state.flags.includes('herb-done') ? '已完成' : '支線'}`),
        paragraph(
          state.flags.includes('herb-done')
            ? '青蘭已交給蘇長胤，藥香留在門中。'
            : '與蘇長胤交談，在後山採集青蘭並交還。',
        ),
        heading(`松風尋酒 · ${state.flags.includes('wine-done') ? '已完成' : '支線'}`),
        paragraph(
          state.flags.includes('wine-done')
            ? '酒壺物歸原主，王長風又有了談興。'
            : '在松風林找到酒壺，交給王長風。',
        ),
        heading('江湖記得'),
        paragraph(
          state.flags.includes('mercy')
            ? '你曾救助受傷的山賊，以善意換得線索。'
            : state.flags.includes('force')
              ? '你以武力清開山道，從口供得知後山異狀。'
              : '你的選擇，將寫在這一頁。',
        ),
      ],
    };
  }

  private settings(options: PanelOptions): GamePanel {
    return {
      title: '旅途設定',
      rows: [
        heading('簡化介面動態'),
        action(options.reducedMotion ? '已開啟' : '已關閉', 'motion'),
        heading('音效音量'),
        ...[0, 0.25, 0.5, 1].map((volume) => ({
          ...action(
            `${volume === 0 ? '靜音' : `${volume * 100}%`}${volume === options.audioVolume ? ' · 使用中' : ''}`,
            `volume:${volume}`,
          ),
          disabled: volume === options.audioVolume,
        })),
        paragraph(
          '點擊地面移動，點選人物互動，或從「附近」選擇目的地。Esc 關閉面板，空白鍵暫停戰鬥。姓名與武學在開局時決定。',
        ),
        action('切換全螢幕', 'fullscreen'),
        action('儲存並返回主選單', 'menu-confirm'),
      ],
    };
  }
}
