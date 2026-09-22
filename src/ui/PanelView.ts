import { INNER_ARTS, ITEMS, QUESTS, SKILLS } from '../data/content';
import { MAPS } from '../data/maps';
import { HAIR_NAMES, HAIR_STYLES } from '../game/appearance';
import type { GameState, ItemId } from '../game/types';
import { button, escapeHtml as esc, portrait } from './html';

export type Panel = 'character' | 'bag' | 'journal' | 'save' | 'shop' | 'settings';
export interface PanelOptions {
  saveSlots: string;
  reducedMotion: boolean;
  audioVolume: number;
}

export class PanelView {
  render(state: GameState, panel: Panel, options: PanelOptions): string {
    let html = '';
    let title = '';
    if (panel === 'character') {
      title = '角色與武學';
      html = `<div class="character-sheet"><div class="sheet-portrait">${portrait()}</div><div><span class="eyebrow">${state.route === 'sword' ? '劍意清明' : '氣沉丹田'}</span><h3>${esc(state.name)} · 第 ${state.level} 重</h3><p>${INNER_ARTS[state.route].description}</p><div class="equipment-row"><span>武器</span><strong>${state.weapon ? ITEMS[state.weapon].name : '尚未裝備'}</strong></div><div class="equipment-row"><span>防具</span><strong>${state.armor ? ITEMS[state.armor].name : '尚未裝備'}</strong></div></div></div><h3 class="section-title">所習招式</h3><div class="skill-grid">${SKILLS[state.route].map((skill) => `<div class="skill-card"><span class="tiny-label">內力 ${skill.cost}</span><h3>${skill.name}</h3><p>${skill.description}</p></div>`).join('')}</div>`;
      html += `<h3 class="section-title">髮型與頭飾</h3><p>只改變外觀，不影響能力。關閉面板即可在地圖上查看。</p><div class="save-actions">${HAIR_STYLES.map((hair) => button(`${HAIR_NAMES[hair]}${state.hair === hair ? ' · 使用中' : ''}`, `hair:${hair}`, 'small-button', state.hair === hair)).join('')}</div>`;
    } else if (panel === 'bag' || panel === 'shop') {
      title = panel === 'shop' ? '山門小鋪' : '隨身行囊';
      html = `<div class="panel-intro"><span>${panel === 'shop' ? '行走江湖，有備無患。售價為買價的一半。' : '物品與任務線索都收在這裡。'}</span><strong>◈ ${state.gold} 兩</strong></div><div class="inventory-list">${
        (Object.entries(ITEMS) as [ItemId, (typeof ITEMS)[ItemId]][])
          .filter(([id, item]) =>
            panel === 'shop' ? item.kind !== 'quest' : state.inventory[id] > 0,
          )
          .map(([id, item]) => {
            const equipped = state.weapon === id || state.armor === id;
            const wrongRoute =
              (id === 'sword' && state.route !== 'sword') ||
              (id === 'wraps' && state.route !== 'fist');
            return `<div class="item-row"><span class="item-symbol">${{ medicine: '藥', weapon: '刃', armor: '衣', quest: '物' }[item.kind]}</span><div class="item-info"><h3>${item.name}<small>×${state.inventory[id]} ${equipped ? '· 已裝備' : ''}</small></h3><p>${item.description}</p></div><div class="item-actions">${panel === 'shop' ? `${button(`買 ${item.price} 兩`, `buy:${id}`, 'small-button', state.gold < item.price || state.inventory[id] >= 99)}${button(`賣 ${Math.floor(item.price / 2)} 兩`, `sell:${id}`, 'small-button subtle', state.inventory[id] <= 0 || (equipped && state.inventory[id] <= 1))}` : item.kind === 'medicine' ? button('使用', `use:${id}`, 'small-button') : item.kind === 'weapon' || item.kind === 'armor' ? button(equipped ? '已裝備' : wrongRoute ? '武學不符' : '裝備', `equip:${id}`, 'small-button', equipped || wrongRoute) : '<span class="tiny-label">任務物品</span>'}</div></div>`;
          })
          .join('') || '<p>行囊暫時空著。</p>'
      }</div>`;
    } else if (panel === 'journal') {
      title = '江湖手札';
      html = `<div class="journal-entry main-quest"><span class="tiny-label">主線 · ${state.quest === 'complete' ? '已完成' : '進行中'}</span><h3>${QUESTS[state.quest].title}</h3><p>${QUESTS[state.quest].detail}</p></div><div class="journal-entry"><span class="tiny-label">支線 · ${state.flags.includes('herb-done') ? '已完成' : state.flags.includes('herb-quest') || state.inventory.flower ? '進行中' : '尚未接受'}</span><h3>山間一味</h3><p>${state.flags.includes('herb-done') ? '青蘭已交給蘇長胤，藥香留在門中。' : '與蘇長胤交談，在後山採集青蘭並交還。'}</p></div><div class="journal-entry"><span class="tiny-label">支線 · ${state.flags.includes('wine-done') ? '已完成' : state.flags.includes('wine-quest') || state.inventory.wine ? '進行中' : '尚未接受'}</span><h3>松風尋酒</h3><p>${state.flags.includes('wine-done') ? '酒壺物歸原主，王長風又有了談興。' : '在松風林找到酒壺，交給王長風。'}</p></div><div class="choice-record"><span class="tiny-label">江湖記得</span><p>${state.flags.includes('mercy') ? '你曾以金創藥救助受傷的山賊，以善意換得線索。' : state.flags.includes('force') ? '你以武力清開山道，從山賊口供得知後山異狀。' : '你的選擇，將寫在這一頁。'}</p></div>`;
    } else if (panel === 'save') {
      title = '存檔與讀檔';
      html =
        options.saveSlots +
        `<div class="save-actions">${button('手動存檔', 'save', 'primary')}${button('匯出目前進度', 'export')}${button('匯入備份', 'import')}</div><p class="panel-footnote">存檔保留在此瀏覽器。清除網站資料會移除存檔，建議匯出備份。戰鬥及對話中不存檔。</p>`;
    } else {
      title = '旅途設定';
      html = `<div class="setting-row"><div><h3>簡化介面動態</h3><p>減少介面動畫，不改變戰鬥時間。</p></div>${button(options.reducedMotion ? '已開啟' : '已關閉', 'motion')}</div><h3>音效音量</h3><p>介面、命中、治療與戰鬥結果提示。切換音量可試聽，背景分頁不播放。</p><div class="save-actions">${[0, 0.25, 0.5, 1].map((volume) => button(`${volume === 0 ? '靜音' : `${volume * 100}%`}${volume === options.audioVolume ? ' · 使用中' : ''}`, `volume:${volume}`, 'small-button', volume === options.audioVolume)).join('')}</div><div class="note-card">操作：點擊地面移動，點選人物或右側地點前往互動。Esc 關閉面板。戰鬥中按空白鍵暫停。角色姓名與武學路線在開局時決定。</div><p class="panel-footnote">目前音效為合成提示音，背景音樂與正式音效仍待製作。</p>${button('儲存並返回主選單', 'menu-confirm', 'danger-button')}`;
    }
    return `<div class="modal-heading"><div><span class="eyebrow">口袋江湖 · ${MAPS[state.map].name}</span><h2>${title}</h2></div>${button('×', 'close', 'close-button')}</div>${html}`;
  }
}
