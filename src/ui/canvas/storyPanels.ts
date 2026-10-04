import { CHAPTER_REWARD, ENCOUNTERS, ITEMS } from '../../data/content';
import type { Battle } from '../../game/battle';
import type { SparringCue } from '../../game/SparringLesson';
import { createGame, getStats } from '../../game/state';
import type { Dialogue } from '../../game/story';
import type { GameState, MapEntity, Route, ItemId } from '../../game/types';
import { action, heading, paragraph, type GamePanel } from './model';

export function equipmentRewardPanel(id: ItemId, message: string): GamePanel {
  const item = ITEMS[id];
  return {
    title: '獲得新行裝',
    layout: 'notice',
    rows: [
      { kind: 'text', text: `${item.name} ×1`, emphasis: 'heading', icon: `item-icon:${id}` },
      paragraph(item.description),
      paragraph(message),
      paragraph('已收入行囊，尚未換上。'),
      action('查看並換裝', `inspect-item:${id}`),
      action('繼續探索', 'close'),
    ],
  };
}

export function dialoguePanel(
  dialogue: Dialogue,
  index: number,
  entity?: MapEntity,
  hero?: GameState,
): GamePanel {
  const last = index === dialogue.lines.length - 1;
  const portrait =
    entity?.kind === 'enemy' && entity.encounter
      ? `enemy:${ENCOUNTERS[entity.encounter].enemies[0]}`
      : entity?.id === 'wounded'
        ? 'portrait:bandit'
        : entity?.kind === 'npc'
          ? `npc:${entity.id}`
          : entity?.kind === 'chest'
            ? 'item-icon:chest'
            : entity?.id === 'wine'
              ? 'item-icon:wine'
              : entity?.kind === 'herb'
                ? 'item-icon:flower'
                : entity?.kind === 'clue'
                  ? 'item-icon:journal'
                  : undefined;
  return {
    layout: 'dialogue',
    title:
      dialogue.beats?.[index]?.portrait === 'player'
        ? (hero?.name ?? '你')
        : (dialogue.beats?.[index]?.speaker ?? dialogue.speaker),
    subtitle: `${dialogue.beats?.[index]?.portrait === 'player' ? '你的回應' : dialogue.role} · ${index + 1}/${dialogue.lines.length}`,
    dismissible: false,
    skipAction: last ? undefined : 'dialogue-skip',
    portrait: dialogue.beats?.[index]?.portrait ?? dialogue.portrait ?? portrait,
    hero,
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
    layout: 'creation',
    hero: createGame(draft.name, draft.route),
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

export function sparringLessonPanel(cue: SparringCue): GamePanel {
  const defense = cue.kind === 'defend';
  return {
    title: defense ? '看準起手 · 先守一招' : '重擊已過 · 趁隙還擊',
    layout: 'notice',
    dismissible: false,
    rows: [
      heading(defense ? '入門切磋 1 / 2 · 已暫停' : '入門切磋 2 / 2 · 已暫停'),
      paragraph(
        defense
          ? '弟子正在蓄力，還沒打中你。現在收勢防禦，花 20 腳力，這一擊減傷 60%。'
          : cue.missed
            ? '這一擊落空了，弟子正在收勢。下一次命中有 35% 追擊加成。'
            : cue.blocked > 0
              ? `你擋下 ${cue.blocked} 點傷害，只受到 ${cue.damage} 點。弟子露出破綻，下一次命中傷害增加 35%。`
              : `你受到 ${cue.damage} 點傷害。重擊後弟子會露出破綻，下一次命中傷害增加 35%。`,
      ),
      paragraph(
        defense
          ? '往後看到重擊起手，也能拉開距離閃避。'
          : '回到戰鬥後點選攻擊招式，預約下一擊。也可按空白鍵暫停，慢慢選。',
      ),
      action(defense ? '停步，立即防禦' : '暫停選招', defense ? 'lesson:defend' : 'lesson:choose'),
      action(defense ? '略過教學' : '繼續交鋒', defense ? 'lesson:skip' : 'lesson:continue'),
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
        `操作區會直接顯示「我打得到」或「太遠打不到」。你的射程是 ${span(mine)}，${enemy.name}的射程是 ${span(theirs)}。畫面也會顯示對方現在能不能打到你。`,
      ),
      paragraph(
        '用「貼近對手」「保持射程」「拉開距離」選站位，角色會自己移動。走動會消耗腳力，按「停步回氣」可站定恢復。',
      ),
      heading('四、看到紅色警示就閃或擋'),
      paragraph(
        '敵人起手到命中之間有一小段時間。這時拉開到敵人射程外就能閃掉，或按「立即防禦」，花 20 腳力把這一擊的傷害降到四成。',
      ),
      heading('五、氣勢與破綻'),
      paragraph(
        '每次普攻、每次擋下攻擊，都會累積一格氣勢。三格滿了再用攻擊招式，威力提高 35%，還會把敵人的出手進度打退一半。',
      ),
      paragraph(
        '敵人使出重擊之後會露出破綻，你下一次命中多 35% 傷害。領悟「乘隙而入」後提高至 55%。',
      ),
      heading('六、打哪裡有差別'),
      paragraph(
        '點右上的人形圖選擇攻擊部位。打傷手臂，對方的雙手招式會變弱。打傷腿，對方走得慢。你自己的傷勢也一樣，紅色是受傷，黑色是損毀。',
      ),
      action('知道了，回到戰鬥', 'battle-help-close'),
    ],
  };
}

export function endingPanel(state: GameState): GamePanel {
  const followUp =
    !state.flags.includes('herb-done') &&
    (state.flags.includes('herb-quest') || state.inventory.flower > 0)
      ? action('繼續山間一味 · 帶路', 'guide:herb')
      : !state.flags.includes('wine-done') &&
          (state.flags.includes('wine-quest') || state.inventory.wine > 0)
        ? action('繼續松風尋酒 · 帶路', 'guide:wine')
        : null;
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
      {
        kind: 'text',
        text: `師父贈禮：${ITEMS.jade.name} ×${CHAPTER_REWARD.jade}\n銀兩 +${CHAPTER_REWARD.gold} · 修為 +${CHAPTER_REWARD.xp}`,
        icon: 'item-icon:jade',
      },
      paragraph('拜別師父時，生命、內力與部位傷勢已恢復。'),
      paragraph('洛陽篇尚未開放，你仍可探索四個區域、完成支線與整理行囊。'),
      ...(followUp ? [followUp] : []),
      action('留在江湖，繼續探索', 'close'),
      action('匯出旅程備份', 'export'),
    ],
  };
}
