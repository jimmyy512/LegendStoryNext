import { ITEMS } from '../../data/content';
import type { Battle } from '../../game/battle';
import { getStats } from '../../game/state';
import type { Dialogue } from '../../game/story';
import type { GameState, Route } from '../../game/types';
import { action, heading, paragraph, type GamePanel } from './model';

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

/** 交鋒規則的白話說明，射程數字取自當下的武器與對手。 */
export function combatGuidePanel(battle: Battle): GamePanel {
  const mine = battle.attackRange();
  const enemy = battle.enemies[battle.target];
  const theirs = battle.enemyRange(battle.target);
  const span = (r: { min: number; max: number }) => `${r.min}～${r.max}`;
  return {
    title: '交鋒說明',
    subtitle: '看說明時戰鬥暫停',
    rows: [
      heading('一、出手是自動的'),
      paragraph('雙方都有一條出手進度。進度滿了，只要對手在射程內，就會自動普攻。不用一直點攻擊。'),
      heading('二、招式是預約下一擊'),
      paragraph(
        '點招式不會馬上出手，而是把下一次普攻換成這一招。進度滿、進入射程才起招並扣內力。起招到命中之間，對手若退出射程，這一招就落空。',
      ),
      heading('三、距離決定誰打得到誰'),
      paragraph(
        `下方距離尺的綠條是你的射程（${span(mine)}），紅條是${enemy.name}的射程（${span(theirs)}），白點是現在的距離。白點在綠條上你打得到，在紅條上對方打得到你。`,
      ),
      paragraph(
        '近身、持距、拉開會讓角色自己走到那個距離，也可以直接點距離尺。走動消耗腳力，停步回氣可以站定恢復。',
      ),
      heading('四、看到紅色警示就閃或擋'),
      paragraph(
        '敵人起手到命中之間有一小段時間。這時拉開到紅條外面就能閃掉，或按立即防禦，花 20 腳力把這一擊的傷害降到四成。',
      ),
      heading('五、氣勢與破綻'),
      paragraph(
        '每次普攻、每次擋下攻擊，都會累積一格氣勢。三格滿了再用攻擊招式，威力提高 35%，還會把敵人的出手進度打退一半。',
      ),
      paragraph('敵人使出重擊之後會露出破綻，你下一次命中多 35% 傷害。'),
      heading('六、打哪裡有差別'),
      paragraph(
        '點右上的人形圖選擇攻擊部位。打傷手臂，對方的雙手招式會變弱。打傷腿，對方走得慢。你自己的傷勢也一樣，紅色是受傷，黑色是損毀。',
      ),
      action('知道了，回到戰鬥', 'battle-help-close'),
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
