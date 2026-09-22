import { QUESTS } from '../data/content';
import type { Battle } from './battle';
import { gainExperience, restore, setFlag } from './state';
import type { GameState, MapEntity } from './types';

export interface Choice {
  label: string;
  action: string;
  note?: string;
}
export interface Dialogue {
  speaker: string;
  role: string;
  lines: string[];
  choices: Choice[];
}
export interface StoryOutcome {
  message?: string;
  battle?: string;
  shop?: boolean;
  ending?: boolean;
}
const leave: Choice = { label: '告辭', action: 'close' };

export function isEntityVisible(state: GameState, entity: MapEntity): boolean {
  if (entity.kind === 'enemy' && state.defeated.includes(entity.encounter!)) {
    return false;
  }
  if (entity.id === 'trial') {
    return state.quest === 'trial';
  }
  if (entity.id === 'bandits') {
    return state.quest === 'bandits';
  }
  if (entity.id === 'boss') {
    return state.quest === 'boss';
  }
  if (entity.id === 'flower') {
    return !state.flags.includes('flower-picked');
  }
  if (entity.id === 'wine') {
    return !state.flags.includes('wine-picked');
  }
  return true;
}

export function getDialogue(state: GameState, entity: MapEntity): Dialogue {
  const dialogue = (
    speaker: string,
    role: string,
    lines: string[],
    choices: Choice[] = [leave],
  ): Dialogue => ({ speaker, role, lines, choices });
  switch (entity.id) {
    case 'qing':
      if (state.quest === 'arrival') {
        return dialogue(
          '徐長卿',
          '全真派 · 大師兄',
          [
            `你便是${state.name}？山路辛苦了。我是徐長卿，門中師兄弟都喚我長卿。`,
            '師父常說，武功是護人之術。去演武場與弟子過上幾招吧，記得看清對手的動作，再決定攻守。',
          ],
          [{ label: '請師兄指教', action: 'accept-trial', note: '開啟門前試招' }],
        );
      }
      return dialogue(
        '徐長卿',
        '全真派 · 大師兄',
        [
          QUESTS[state.quest].detail,
          '若敵人準備重擊，便先防守。劍法重破綻，拳掌重反擊，別一味強攻。',
        ],
        [{ label: '在此調息', action: 'rest', note: '恢復生命、內力與部位傷勢' }, leave],
      );
    case 'master':
      if (state.quest === 'report') {
        return dialogue(
          '上真道長',
          '全真派 · 掌門',
          [
            '長卿已告訴我你的表現。勝負在其次，懂得進退，才走得遠。',
            '這套衣物與兵器便交給你。近日山下有刀客攔路，你去探明原委。若能以言語化干戈，也是一種本事。',
          ],
          [{ label: '弟子領命', action: 'join', note: '獲得武器、道袍與補給' }],
        );
      }
      if (state.quest === 'return') {
        return dialogue(
          '上真道長',
          '全真派 · 掌門',
          [
            '長恨的事情，長卿已傳信告知。當年未能救回靈姍，是我們始終不願面對的傷口。',
            '傷痛不能成為傷人的理由。我會陪他收拾禁地的殘局，也會讓門中記下真相。',
            state.flags.includes('mercy')
              ? '你在山下救過的那個人，已答應帶路尋回失散的旅人。善意有時比刀劍走得更遠。'
              : '山道已通，但那些流落山林的人仍無處可去。待此事安定，我們還得再走一趟。',
            `${state.name}，帶著這枚玉佩去洛陽看看吧。江湖很大，別急著替每個人下定論。`,
          ],
          [{ label: '拜別師父', action: 'finish', note: '完成第一章' }],
        );
      }
      return dialogue(
        '上真道長',
        '全真派 · 掌門',
        [
          state.quest === 'complete'
            ? '山門永遠為你留著。等準備好了，再往更遠的地方去。'
            : QUESTS[state.quest].detail,
        ],
        [{ label: '在門中休息', action: 'rest', note: '恢復生命、內力與部位傷勢' }, leave],
      );
    case 'yin':
      if (state.flags.includes('herb-done')) {
        return dialogue(
          '蘇長胤',
          '全真派 · 藥理',
          ['你帶來的青蘭已製成藥。山路雖險，也藏著救人的東西。'],
          [{ label: '看看藥品', action: 'shop' }, leave],
        );
      }
      if (state.inventory.flower > 0) {
        return dialogue(
          '蘇長胤',
          '全真派 · 藥理',
          ['這正是山間青蘭！多謝師弟，這瓶回春丹與一些盤纏你收好。'],
          [
            {
              label: '交付山間青蘭',
              action: 'deliver-flower',
              note: '回春丹 ×1、銀兩 +25、經驗 +20',
            },
            leave,
          ],
        );
      }
      return dialogue(
        '蘇長胤',
        '全真派 · 藥理',
        ['後山石旁生著青蘭，若你順路經過，可替我採一株？我正在替山下百姓配藥。'],
        [
          { label: '我會留意', action: 'accept-flower', note: '支線：山間一味' },
          { label: '看看藥品', action: 'shop' },
          leave,
        ],
      );
    case 'fong':
      if (state.flags.includes('wine-done')) {
        return dialogue('王長風', '全真派 · 灑脫師兄', [
          '有酒有風，還有肯替人跑腿的小師弟。改日我教你一套醉拳！',
        ]);
      }
      if (state.inventory.wine > 0) {
        return dialogue(
          '王長風',
          '全真派 · 灑脫師兄',
          ['哈！我的酒壺。原來落在松風林了。這瓶養氣散與盤纏便算謝禮。'],
          [
            { label: '歸還酒壺', action: 'deliver-wine', note: '養氣散 ×2、銀兩 +20、經驗 +20' },
            leave,
          ],
        );
      }
      return dialogue(
        '王長風',
        '全真派 · 灑脫師兄',
        ['師弟可曾見到一只酒壺？昨日路過松風林，只顧看山色，竟把它忘了。'],
        [{ label: '替師兄找找', action: 'accept-wine', note: '支線：松風尋酒' }, leave],
      );
    case 'wo':
      return dialogue(
        '陳長悟',
        '全真派 · 師叔',
        [
          '嗯，很好，很好。出門在外，行囊裡多備些藥，身上少帶些傲氣。',
          '需要什麼便看看。身上穿著的最後一件裝備，我可不收。',
        ],
        [{ label: '買賣物品', action: 'shop' }, { label: '坐下調息', action: 'rest' }, leave],
      );
    case 'wounded':
      if (state.flags.includes('mercy')) {
        return dialogue('受傷的山賊', '山下 · 傷者', [
          '那夜有人把失神的旅人帶往後山。他身穿全真道袍，我只記得袖口有一道暗紅色紋路。',
          '你的救命之恩，我記下了。我會勸兄弟們離開這條山路。',
        ]);
      }
      if (state.quest !== 'bandits') {
        return dialogue('受傷的山賊', '山下 · 傷者', ['我不是來找麻煩的……先讓我歇一會兒。']);
      }
      return dialogue(
        '受傷的山賊',
        '山下 · 傷者',
        [
          '我們本是行腳人。後山近日有人失蹤，兄弟們驚慌之下才攔路索糧。',
          '你若肯替我止血，我便勸他們退走，也把那晚看見的事告訴你。',
        ],
        [
          { label: '替他療傷', action: 'mercy', note: '金創藥 ×1，和平處理山賊事件' },
          { label: '我會親自問清楚', action: 'close', note: '仍可前往挑戰山賊頭目' },
        ],
      );
    case 'bandits':
      return dialogue(
        '山賊頭目',
        '松風林 · 攔路者',
        ['全真派的人？你若堅持往前，便先過我這一關！'],
        [
          { label: state.route === 'sword' ? '拔劍應戰' : '出掌應戰', action: 'battle:bandits' },
          { label: '暫且退開', action: 'close' },
        ],
      );
    case 'trial':
      return dialogue(
        '試招弟子',
        '全真派 · 演武場',
        ['點到為止，請！蓄勢滿後會自動普攻。你可預約招式或防禦，按空白鍵暫停查看傷勢。'],
        [{ label: '開始切磋', action: 'battle:trial' }, leave],
      );
    case 'patrol':
      return dialogue(
        '迷途刀客',
        '松風林 · 遭遇',
        ['此路是我……罷了，還是手底下見真章吧。'],
        [{ label: '迎戰', action: 'battle:patrol' }, leave],
      );
    case 'undead':
      return dialogue(
        '失心傀儡',
        '藏霧洞 · 異變',
        ['通道深處傳來低啞的嘶吼。兩道人影緩緩轉過身，擋住去路。'],
        [
          { label: '準備戰鬥', action: 'battle:undead' },
          { label: '先行退開', action: 'close' },
        ],
      );
    case 'boss':
      if (!state.defeated.includes('undead')) {
        return dialogue('洪長恨', '全真派 · 二師兄', [
          '傀儡仍守著通道。先處理身後的威脅，才能安心與他對質。',
        ]);
      }
      return dialogue(
        '洪長恨',
        '全真派 · 二師兄',
        [
          '你看過那本手札了？二十年了，人人都叫我放下，可有誰還記得她的名字？',
          state.flags.includes('mercy')
            ? '那個山下的人竟肯為你帶路……也罷，你若真有本事，就來阻止我。'
            : '既然走到了這裡，你也要像他們一樣，告訴我何為對錯嗎？',
        ],
        [
          { label: '師兄，請收手', action: 'battle:boss', note: '首領會蓄勢重擊，留意防禦與補給' },
          { label: '先做準備', action: 'close' },
        ],
      );
    case 'journal':
      if (state.quest === 'investigate') {
        return dialogue(
          '殘缺手札',
          '藏霧洞 · 線索',
          [
            '「靈姍，若這世間還有一線生機，我便不信命。」',
            '筆跡與二師兄相同。後幾頁記著禁術與失蹤旅人的名字，墨跡尚新。',
          ],
          [{ label: '收起手札，尋找長恨', action: 'journal' }],
        );
      }
      return dialogue('殘缺手札', '藏霧洞 · 線索', ['石臺上只餘散落的紙頁，燈火映著乾涸的墨跡。']);
    case 'flower':
      return dialogue(
        '山間青蘭',
        '後山 · 採集',
        ['青蘭生於石縫，葉上還帶著晨露。蘇長胤或許用得上。'],
        [{ label: '採下青蘭', action: 'pick-flower' }, leave],
      );
    case 'wine':
      return dialogue(
        '遺落的酒壺',
        '松風林 · 遺物',
        ['壺身刻著一個「風」字，裡面還殘留著淡淡酒香。'],
        [{ label: '拾起酒壺', action: 'pick-wine' }, leave],
      );
    default:
      if (entity.kind === 'chest') {
        return dialogue(
          entity.name,
          '探索 · 木箱',
          [
            state.opened.includes(entity.id)
              ? '木箱已經空了。'
              : '木箱的銅扣已鬆開，裡面似乎有前人留下的物資。',
          ],
          state.opened.includes(entity.id)
            ? [leave]
            : [{ label: '打開木箱', action: `chest:${entity.id}` }, leave],
        );
      }
      return dialogue(entity.name, '江湖', ['風過山林，且行且看。']);
  }
}

export function applyStoryAction(state: GameState, action: string): StoryOutcome {
  if (action === 'close') {
    return {};
  }
  if (action === 'shop') {
    return { shop: true };
  }
  if (action === 'rest') {
    restore(state);
    return { message: '調息與治療完畢，生命、內力與部位傷勢已恢復。' };
  }
  if (action.startsWith('battle:')) {
    return { battle: action.slice(7) };
  }
  if (action === 'accept-trial' && state.quest === 'arrival') {
    state.quest = 'trial';
    return { message: '前往演武場，與試招弟子切磋。' };
  }
  if (action === 'join' && state.quest === 'report') {
    state.quest = 'bandits';
    state.weapon = state.route === 'sword' ? 'sword' : 'wraps';
    state.armor = 'robe';
    state.inventory[state.weapon]++;
    state.inventory.robe++;
    state.inventory.herb += 2;
    state.inventory.tonic++;
    restore(state);
    return { message: '拜入全真，已穿戴門派裝備並獲得補給。' };
  }
  if (action === 'mercy' && state.quest === 'bandits') {
    if (!state.inventory.herb) {
      return { message: '需要一份金創藥，可回門派購買。' };
    }
    state.inventory.herb--;
    setFlag(state, 'mercy');
    state.quest = 'investigate';
    state.inventory.letter++;
    state.gold += 36;
    gainExperience(state, 60);
    return { message: '山賊答應離去。取得後山線索、36 銀兩與 60 經驗。' };
  }
  if (action === 'journal' && state.quest === 'investigate') {
    state.quest = 'boss';
    state.inventory.journal++;
    return { message: '取得殘缺手札，尋找洞穴深處的洪長恨。' };
  }
  if (action === 'finish' && state.quest === 'return') {
    state.quest = 'complete';
    state.inventory.jade++;
    state.gold += 50;
    gainExperience(state, 60);
    restore(state);
    return { ending: true };
  }
  if (action === 'accept-flower') {
    setFlag(state, 'herb-quest');
    return { message: '支線已記錄：前往後山尋找山間青蘭。' };
  }
  if (action === 'accept-wine') {
    setFlag(state, 'wine-quest');
    return { message: '支線已記錄：在松風林尋找酒壺。' };
  }
  if (action === 'pick-flower' && setFlag(state, 'flower-picked')) {
    state.inventory.flower++;
    return { message: '取得山間青蘭，可交給蘇長胤。' };
  }
  if (action === 'pick-wine' && setFlag(state, 'wine-picked')) {
    state.inventory.wine++;
    return { message: '取得遺落的酒壺，可交給王長風。' };
  }
  if (action === 'deliver-flower' && state.inventory.flower > 0 && setFlag(state, 'herb-done')) {
    state.inventory.flower--;
    state.inventory.elixir++;
    state.gold += 25;
    gainExperience(state, 20);
    return { message: '山間一味完成：回春丹 ×1、銀兩 +25、經驗 +20。' };
  }
  if (action === 'deliver-wine' && state.inventory.wine > 0 && setFlag(state, 'wine-done')) {
    state.inventory.wine--;
    state.inventory.tonic += 2;
    state.gold += 20;
    gainExperience(state, 20);
    return { message: '松風尋酒完成：養氣散 ×2、銀兩 +20、經驗 +20。' };
  }
  if (action.startsWith('chest:')) {
    const id = action.slice(6);
    if (
      !['forest-chest', 'mountain-chest', 'cave-chest'].includes(id) ||
      state.opened.includes(id)
    ) {
      return {};
    }
    state.opened.push(id);
    state.gold += 20;
    state.inventory.herb++;
    state.inventory.tonic++;
    return { message: '木箱中找到 20 銀兩、金創藥 ×1、養氣散 ×1。' };
  }
  return {};
}

export function settleBattle(state: GameState, battle: Battle): string {
  if (!battle.result) {
    return '';
  }
  if (battle.result === 'defeat') {
    restore(state);
    return '你退回安全處調息。此次戰鬥的消耗已復原，可重新挑戰或回門派整備。';
  }
  if (battle.result === 'victory' && state.defeated.includes(battle.encounterId)) {
    return '這場戰鬥的獎勵已領取。';
  }
  state.hp = battle.player.hp;
  state.body = structuredClone(battle.player.body);
  state.mp = battle.player.mp;
  state.inventory = structuredClone(battle.player.inventory);
  if (battle.result === 'escaped') {
    return '已撤離戰鬥，保留目前生命、內力與道具消耗。';
  }
  state.defeated.push(battle.encounterId);
  state.gold += battle.reward.gold;
  const levels = gainExperience(state, battle.reward.xp);
  if (battle.encounterId === 'trial' && state.quest === 'trial') {
    state.quest = 'report';
  }
  if (battle.encounterId === 'bandits' && state.quest === 'bandits') {
    state.quest = 'investigate';
    state.inventory.letter++;
    setFlag(state, 'force');
  }
  if (battle.encounterId === 'boss' && state.quest === 'boss') {
    state.quest = 'return';
  }
  return `獲得 ${battle.reward.gold} 銀兩、${battle.reward.xp} 經驗。${levels ? `提升 ${levels} 級，生命與內力已恢復。` : ''}${battle.encounterId === 'boss' ? '長恨放下雙手，答應回山面對往事。' : ''}`;
}
