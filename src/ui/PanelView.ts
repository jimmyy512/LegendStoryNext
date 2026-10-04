import { INNER_ARTS, ITEMS, QUESTS, SKILLS } from '../data/content';
import { HAIR_NAMES, SELECTABLE_HAIR_STYLES } from '../game/appearance';
import { BODY_PARTS, PART_CAPACITY, PART_NAMES, bodyCondition, movementRate } from '../game/body';
import { getStats } from '../game/state';
import { availableTalentPoints } from '../game/talents';
import { isEquipped, equipmentSlot, SLOT_NAMES, EQUIPMENT_SLOTS } from '../game/equipment';
import { nextObjective, objectiveLabel, type ObjectiveKind } from '../game/objectives';
import {
  FIRST_COMPANIONS,
  CHANCE_ENCOUNTERS,
  companionProgress,
  companionMeeting,
  encounterRecords,
} from '../game/chanceEncounters';
import type { GameState, ItemId } from '../game/types';
import { action, heading, paragraph, type GamePanel, type PanelRow } from './canvas/model';

import { canReceiveItem, usedBagSlots, BAG_CAPACITY } from '../game/inventory';

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
        return this.bag(state);
      case 'shop':
        return {
          title: '雜貨鋪 · 買賣物品',
          subtitle: `行囊 ${usedBagSlots(state)} / ${BAG_CAPACITY} 格`,
          rows: this.inventory(state, 'shop'),
        };
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
    const selectedHair = state.hair === 'Hair3' ? 'Hair1' : state.hair;
    const panel: GamePanel = {
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
        heading('整理髮型'),
        paragraph('只改變外觀，不影響能力。關閉面板即可查看。'),
        ...SELECTABLE_HAIR_STYLES.map((hair) => ({
          ...action(
            `${HAIR_NAMES[hair]}${selectedHair === hair ? ' · 使用中' : ''}`,
            `hair:${hair}`,
          ),
          disabled: selectedHair === hair,
        })),
      ],
    };
    panel.layout = 'folio';
    panel.subtitle = `${INNER_ARTS[state.route].name} · 修為 ${state.xp}/${state.level * 60}`;
    panel.hero = state;
    panel.sections = [
      {
        id: 'overview',
        title: '俠客',
        caption: '能力與裝備',
        hero: true,
        rows: [
          paragraph(`生命 ${state.hp} / ${stats.maxHp}    內力 ${state.mp} / ${stats.maxMp}`),
          paragraph(`攻擊 ${stats.attack}    防禦 ${stats.defense}    身法 ${stats.speed}`),
          heading('隨身裝備'),
          paragraph(
            EQUIPMENT_SLOTS.map(
              (slot) => `${SLOT_NAMES[slot]}  ${state[slot] ? ITEMS[state[slot]!].name : '未裝備'}`,
            ).join('\n'),
          ),
          action('整理行囊', 'panel:bag'),
        ],
      },
      {
        id: 'skills',
        title: '武學',
        caption: `${SKILLS[state.route].length} 式使用中`,
        rows: [
          heading(INNER_ARTS[state.route].name),
          paragraph(INNER_ARTS[state.route].description),
          ...SKILLS[state.route].flatMap((skill) => [
            { ...heading(skill.name), icon: `skill-icon:${skill.id}` },
            paragraph(`消耗 ${skill.cost} 內力\n${skill.description}`),
          ]),
        ],
      },
      {
        id: 'talents',
        title: '天賦',
        caption: `尚餘 ${availableTalentPoints(state)} 點`,
        rows: [],
      },
      {
        id: 'body',
        title: '傷勢',
        caption: '查看各部位狀況',
        rows: [
          ...(movementRate(state.body) === 0
            ? [
                {
                  ...action('求援回山門\n四肢無法活動，請路人送回山門療傷', 'rescue'),
                  selected: true,
                },
              ]
            : this.recoveryActions(state)),
          { kind: 'body', body: state.body },
        ],
      },
      {
        id: 'look',
        title: '衣冠',
        caption: '整理髮型',
        hero: true,
        rows: [
          heading('整衣束髮'),
          paragraph('選擇後立即套用，不影響能力。'),
          ...SELECTABLE_HAIR_STYLES.map((hair) => ({
            ...action(HAIR_NAMES[hair], `hair:${hair}`),
            selected: selectedHair === hair,
            disabled: selectedHair === hair,
          })),
        ],
      },
    ];
    return panel;
  }

  private bag(state: GameState): GamePanel {
    const names = { medicine: '藥品', weapon: '武器', armor: '防具', quest: '任務物品' };
    return {
      title: '隨身行囊',
      subtitle: `銀兩 ${state.gold} 兩 · 選取物品查看用途`,
      layout: 'folio',
      inventory: true,
      inventoryState: state,
      rows: this.inventory(state, 'bag'),
      sections: (Object.entries(ITEMS) as [ItemId, (typeof ITEMS)[ItemId]][])
        .filter(([id]) => state.inventory[id] > 0)
        .map(([id, item]) => ({
          id,
          icon: `item-icon:${id}`,
          quantity: state.inventory[id],
          equipped: isEquipped(state, id),
          title: `${item.name} ×${state.inventory[id]}`,
          caption: `${equipmentSlot(id) ? SLOT_NAMES[equipmentSlot(id)!] : names[item.kind]}${isEquipped(state, id) ? ' · 裝備中' : ''}`,
          rows: [
            { ...heading(item.name), icon: `item-icon:${id}` },
            paragraph(equipmentSlot(id) ? SLOT_NAMES[equipmentSlot(id)!] : names[item.kind]),
            paragraph(item.description),
            ...(item.attack ? [paragraph(`攻擊 +${item.attack}`)] : []),
            ...(item.defense ? [paragraph(`防禦 +${item.defense}`)] : []),
            ...(item.speed ? [paragraph(`身法 +${item.speed}`)] : []),
            paragraph(`持有 ${state.inventory[id]} 件`),
            ...this.itemActions(state, id),
          ],
        })),
    };
  }

  private inventory(state: GameState, mode: 'bag' | 'shop'): PanelRow[] {
    const rows: PanelRow[] = [paragraph(`隨身銀兩 ${state.gold} 兩`)];
    const entries = (Object.entries(ITEMS) as [ItemId, (typeof ITEMS)[ItemId]][]).filter(
      ([id, item]) => (mode === 'shop' ? item.kind !== 'quest' : state.inventory[id] > 0),
    );
    for (const [id, item] of entries) {
      rows.push(
        {
          kind: 'text',
          emphasis: 'heading',
          text: `${item.name} ×${state.inventory[id]}`,
          icon: `item-icon:${id}`,
        },
        paragraph(item.description),
      );
      rows.push(...(mode === 'shop' ? this.shopActions(state, id) : this.itemActions(state, id)));
    }
    if (!entries.length) {
      rows.push(paragraph('行囊暫時空著。'));
    }
    return rows;
  }

  private shopActions(state: GameState, id: ItemId): PanelRow[] {
    const item = ITEMS[id];
    const equipped = isEquipped(state, id);
    return [
      {
        ...action(`買 ${item.price} 兩`, `buy:${id}`),
        disabled: state.gold < item.price || !canReceiveItem(state, id),
      },
      {
        ...action(`賣 ${Math.floor(item.price / 2)} 兩`, `sell:${id}`),
        disabled: state.inventory[id] <= 0 || (equipped && state.inventory[id] <= 1),
      },
    ];
  }

  private itemActions(state: GameState, id: ItemId): PanelRow[] {
    if (ITEMS[id].kind === 'medicine') {
      const item = ITEMS[id];
      const stats = getStats(state);
      const full = (!item.hp || state.hp >= stats.maxHp) && (!item.mp || state.mp >= stats.maxMp);
      const recovery = [
        item.hp ? `生命 ${state.hp} → ${Math.min(stats.maxHp, state.hp + item.hp)}` : '',
        item.mp ? `內力 ${state.mp} → ${Math.min(stats.maxMp, state.mp + item.mp)}` : '',
      ].filter(Boolean);
      const wounded = BODY_PARTS.some((part) => state.body[part] < PART_CAPACITY[part]);
      return [
        paragraph(`生命 ${state.hp}/${stats.maxHp} · 內力 ${state.mp}/${stats.maxMp}`),
        paragraph(full ? '目前已滿，無需消耗藥品。' : `使用後：${recovery.join('、')}`),
        ...(wounded ? [paragraph('藥品只恢復生命或內力。\n部位傷勢請回門派休息療養。')] : []),
        { ...action(full ? '目前無需使用' : '使用藥品', `use:${id}`), disabled: full },
        ...(wounded ? this.recoveryActions(state) : []),
      ];
    }
    if (ITEMS[id].kind === 'quest') {
      return [paragraph('任務物品')];
    }
    const equipped = isEquipped(state, id);
    const wrongRoute =
      (id === 'sword' && state.route !== 'sword') || (id === 'wraps' && state.route !== 'fist');
    return [
      {
        ...action(equipped ? '已裝備' : wrongRoute ? '武學不符' : '裝備', `equip:${id}`),
        disabled: equipped || wrongRoute,
      },
      ...(equipped ? [action('卸下裝備', `unequip:${id}`)] : []),
    ];
  }

  private recoveryActions(state: GameState): PanelRow[] {
    if (movementRate(state.body) === 0) {
      return [action('求援回山門療傷', 'rescue')];
    }
    const injured = BODY_PARTS.some((part) => state.body[part] < PART_CAPACITY[part]);
    const stats = getStats(state);
    if (!injured && state.hp >= stats.maxHp && state.mp >= stats.maxMp) {
      return [];
    }
    const next = nextObjective(state, 'rest');
    return next
      ? [
          action(
            next.kind === 'npc' ? '找陳長悟調息 · 帶路' : `回門派療傷 · 先前往${next.name}`,
            'guide:rest',
          ),
        ]
      : [];
  }

  private journal(state: GameState): GamePanel {
    const quest = QUESTS[state.quest];
    const panel: GamePanel = {
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
    panel.layout = 'folio';
    panel.subtitle = '第一章 · 松風入江湖';
    panel.sections = [
      { id: 'main', title: quest.title, caption: '主線 · 目前目標', rows: panel.rows.slice(0, 2) },
      {
        id: 'herb',
        title: '山間一味',
        caption: state.flags.includes('herb-done') ? '支線 · 已完成' : '支線 · 尚未完成',
        rows: panel.rows.slice(2, 4),
      },
      {
        id: 'wine',
        title: '松風尋酒',
        caption: state.flags.includes('wine-done') ? '支線 · 已完成' : '支線 · 尚未完成',
        rows: panel.rows.slice(4, 6),
      },
      { id: 'choices', title: '江湖記得', caption: '旅途中的選擇', rows: panel.rows.slice(6) },
      ...(state.quest !== 'arrival'
        ? [
            {
              id: 'revenge',
              title: '韓伯的藥鏢',
              caption: state.flags.includes('revenge-vowed')
                ? '復仇之誓 · 追查中'
                : '身世 · 追查中',
              rows: [
                heading('韓平 · 救過你的老鏢師'),
                paragraph(
                  '韓伯的屋子遭人放火。你帶著他出事前寫的半封信，與押藥車上的銅牌來到全真派。',
                ),
                paragraph(
                  state.flags.includes('revenge-vowed')
                    ? '你向長卿立誓，要找到殺韓伯的人。'
                    : '你決定先練好本事，再查銅牌的來歷。',
                ),
                ...(state.quest !== 'trial' && state.quest !== 'report'
                  ? [
                      heading('藥車與商路'),
                      paragraph(
                        '上真道長認得銅牌的記號。有人借全真的商路運藥，松風林的攔路刀客見過那輛車。',
                      ),
                    ]
                  : []),
                ...(state.flags.includes('mercy')
                  ? [
                      heading('山賊的口供'),
                      paragraph(
                        '韓伯曾把米留給攔路的刀客。押車者雙手包著銅片，藥車在岔路往東走；另有穿道袍的人將旅人帶往後山。',
                      ),
                    ]
                  : []),
                ...(state.inventory.journal > 0
                  ? [
                      heading('春生堂貨單'),
                      paragraph(
                        '藏霧洞手札記著春生堂，交貨人只留了一個「季」字。韓伯的藥車送過這裡。',
                      ),
                    ]
                  : []),
                ...(state.defeated.includes('boss')
                  ? [
                      heading('下一個要找的人 · 季衡'),
                      paragraph(
                        '洪長恨供出送藥者叫季衡，兩手裹銅，人在洛陽春生堂。這是他的口供，仍需對照銅牌、貨單與當晚的證人。',
                      ),
                      paragraph('洛陽尚未開放。線索與復仇之誓已保存在目前存檔。'),
                    ]
                  : []),
              ],
            },
          ]
        : []),
      {
        id: 'companions',
        title: '紅顏與知己',
        caption: '相識的人與下次見面',
        rows: FIRST_COMPANIONS.flatMap((person) => {
          const progress = companionProgress(state, person.id);
          return progress.records.length
            ? [
                heading(`${person.name} · ${progress.stage}`),
                {
                  ...paragraph(
                    `${person.role} · ${person.age}歲\n${person.aim}\n相處 ${progress.trust}／6\n${person.hint}`,
                  ),
                  icon: `portrait:${person.id}`,
                },
                paragraph(progress.records.at(-1)!.choice.result),
                paragraph(companionMeeting(state, person.id).text),
                ...(state.map === person.map
                  ? [
                      action(
                        `${companionMeeting(state, person.id).ready ? '新的話題 · ' : '回訪 · '}${person.name}`,
                        `travel:${person.entity}`,
                      ),
                    ]
                  : []),
              ]
            : [
                heading('尚未相識'),
                paragraph(`可留意${person.hint}。`),
                ...(state.map === person.map
                  ? [action('前往探看', `travel:${person.entity}`)]
                  : []),
              ];
        }),
      },
      {
        id: 'encounters',
        title: '江湖奇遇',
        caption: `已完成 ${encounterRecords(state).length}／${CHANCE_ENCOUNTERS.length}`,
        rows: [
          ...encounterRecords(state).flatMap(({ event, choice }) => [
            heading(event.title),
            paragraph(`你選擇${choice.label}。\n${choice.result}`),
          ]),
          ...(encounterRecords(state).length === 0
            ? [paragraph('松風林的藥箱與藏信處、後山的曲譜，都有值得停下來看看的人與事。')]
            : []),
          paragraph('見過的人可以再拜訪。入門、查禁地或找到手札後，可能有新的話題。'),
        ],
      },
    ];
    panel.sections = panel.sections
      .filter(
        (section) =>
          section.id !== 'herb' ||
          state.flags.includes('herb-quest') ||
          state.flags.includes('herb-done') ||
          state.inventory.flower > 0,
      )
      .filter(
        (section) =>
          section.id !== 'wine' ||
          state.flags.includes('wine-quest') ||
          state.flags.includes('wine-done') ||
          state.inventory.wine > 0,
      );
    for (const section of panel.sections) {
      if (!['main', 'herb', 'wine'].includes(section.id)) {
        continue;
      }
      const kind = section.id as ObjectiveKind;
      const next = nextObjective(state, kind);
      if (kind === 'main' && state.quest === 'bandits') {
        section.rows.push(
          heading('你可以如何處理'),
          paragraph(
            `救助傷者：交出金創藥 ×1，讓山賊退走並取得線索。\n行囊現有 ${state.inventory.herb} 份${state.inventory.herb === 0 ? '，可向全真派購買。' : '。'}`,
          ),
          paragraph(
            '挑戰頭目：擊敗兩名攔路者，從口供追查後山。\n兩種方式都能繼續主線；帶路不會替你決定。',
          ),
        );
        if (state.map === 'forest') {
          section.rows.push(
            action('找傷者談談 · 帶路', 'travel:wounded'),
            action('找山賊頭目 · 帶路', 'travel:bandits'),
          );
          continue;
        }
      }
      if (kind === 'herb' && !state.flags.includes('herb-done')) {
        section.caption = state.inventory.flower > 0 ? '支線 · 可交付' : '支線 · 尋找青蘭';
        section.rows = [
          heading('山間一味'),
          paragraph(
            state.inventory.flower > 0
              ? '青蘭已在行囊，帶回全真派交給蘇長胤。'
              : '前往全真後山，在石旁尋找山間青蘭。',
          ),
        ];
      }
      if (kind === 'wine' && !state.flags.includes('wine-done')) {
        section.caption = state.inventory.wine > 0 ? '支線 · 可交付' : '支線 · 尋找酒壺';
        section.rows = [
          heading('松風尋酒'),
          paragraph(
            state.inventory.wine > 0
              ? '酒壺已在行囊，帶回全真派交給王長風。'
              : '回松風林尋找遺落的酒壺。',
          ),
        ];
      }
      if (next) {
        section.rows.push(action(`${objectiveLabel(next)} · 帶路`, `guide:${kind}`));
      }
    }
    return panel;
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
          '點擊地面移動，點選人物互動，或從「附近」選擇目的地。Esc 關閉面板，空白鍵暫停戰鬥。拜師後可向徐長卿學習另一門武學，再於角色頁切換。',
        ),
        action('切換全螢幕', 'fullscreen'),
        action('儲存並返回主選單', 'menu-confirm'),
      ],
    };
  }
}
