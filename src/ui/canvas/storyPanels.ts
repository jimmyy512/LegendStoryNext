import { ITEMS } from '../../data/content';
import type { Battle } from '../../game/battle';
import { getStats } from '../../game/state';
import type { Dialogue } from '../../game/story';
import type { GameState, Route } from '../../game/types';
import { action, paragraph, type GamePanel } from './model';

export function dialoguePanel(dialogue: Dialogue, index: number): GamePanel {
  const last = index === dialogue.lines.length - 1;
  return {
    title: dialogue.speaker,
    subtitle: `${dialogue.role} · ${index + 1}/${dialogue.lines.length}`,
    dismissible: false,
    rows: [
      paragraph(dialogue.lines[index]),
      ...(last
        ? dialogue.choices.map((choice) =>
            action(
              `${choice.label}${choice.note ? `\n${choice.note}` : ''}`,
              `story:${choice.action}`,
            ),
          )
        : [action('繼續 →', 'dialogue-next')]),
    ],
  };
}

export function creationPanel(draft: { name: string; route: Route }): GamePanel {
  return {
    title: '留下你的名號',
    rows: [
      paragraph('俠客姓名'),
      {
        kind: 'input',
        value: draft.name,
        change: (value) => {
          draft.name = value;
        },
      },
      paragraph('選擇初修武學'),
      {
        ...action('劍法 · 破甲尋隙\n清風破甲 · 落雁一劍', 'route:sword'),
        selected: draft.route === 'sword',
      },
      {
        ...action('拳掌 · 護體反擊\n抱元守一 · 伏龍掌', 'route:fist'),
        selected: draft.route === 'fist',
      },
      paragraph('開始新旅程會更新自動存檔，手動存檔仍會保留。'),
      action('踏入松風林 →', 'create'),
    ],
  };
}

export function medicinePanel(battle: Battle): GamePanel {
  const stats = getStats(battle.player);
  return {
    title: '戰鬥藥品',
    rows: [
      paragraph(
        `生命 ${battle.player.hp}/${stats.maxHp} · 內力 ${battle.player.mp}/${stats.maxMp}`,
      ),
      paragraph('使用藥品會消耗本次行動。'),
      ...(['herb', 'tonic', 'elixir'] as const).map((id) => ({
        ...action(
          `${ITEMS[id].name} ×${battle.player.inventory[id]}\n${ITEMS[id].description}`,
          `battle:item:${id}`,
        ),
        disabled: !battle.player.inventory[id],
      })),
    ],
  };
}

export function endingPanel(state: GameState): GamePanel {
  return {
    title: '江湖未遠 · 第一章完',
    rows: [
      paragraph('長恨終於走出了那座山洞。有些往事還要慢慢說，有些錯也還要慢慢償。'),
      paragraph(
        state.flags.includes('mercy')
          ? '那個受過你幫助的山賊，在山門外留下一束青蘭。'
          : '山道重新通行，遠處又傳來了商旅的鈴聲。',
      ),
      paragraph(
        `第 ${state.level} 重 · ${state.flags.filter((flag) => flag.endsWith('-done')).length}/2 支線 · ${Math.max(1, Math.round(state.playSeconds / 60))} 分鐘旅途`,
      ),
      paragraph('洛陽篇尚未開放，你仍可探索四個區域、完成支線與整理行囊。'),
      action('留在江湖，繼續探索', 'close'),
      action('匯出旅程備份', 'export'),
    ],
  };
}
