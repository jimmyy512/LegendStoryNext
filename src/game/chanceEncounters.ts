import type { Dialogue } from './story';
import type { GameState, ItemId, MapId } from './types';
import type { DialogueBeat } from './chapterOneDialogue';

export const FIRST_COMPANIONS = [
  {
    id: 'qinglan',
    name: '沈青蘭',
    role: '行醫客',
    age: 23,
    entity: 'chance-qinglan',
    map: 'forest',
    hint: '松風林西側的藥箱',
    aim: '查清洛陽假藥的來路。',
  },
  {
    id: 'tangwan',
    name: '唐晚',
    role: '飛賊',
    age: 24,
    entity: 'chance-tangwan',
    map: 'forest',
    hint: '松風林岔路上的藏信處',
    aim: '找到失散的姐姐。',
  },
  {
    id: 'suyin',
    name: '溫素音',
    role: '行腳樂師',
    age: 26,
    entity: 'chance-suyin',
    map: 'mountain',
    hint: '全真後山中央石徑的曲譜',
    aim: '記下被人刻意抹去的往事。',
  },
] as const;
export type CompanionId = (typeof FIRST_COMPANIONS)[number]['id'];
interface EncounterChoice {
  id: string;
  label: string;
  trust: number;
  result: string;
  cost?: ItemId;
  reward?: ItemId;
}
export interface ChanceEncounter {
  id: string;
  title: string;
  companion: CompanionId;
  map: MapId;
  entity: string;
  ready: (state: GameState) => boolean;
  lines: string[];
  beats?: DialogueBeat[];
  choices: EncounterChoice[];
}
const seen = (state: GameState, id: string) =>
  state.flags.some((flag) => flag.startsWith(`chance:${id}:`));
export const CHANCE_ENCOUNTERS: ChanceEncounter[] = [
  {
    id: 'medicine-box',
    title: '藥箱與布條',
    companion: 'qinglan',
    map: 'forest',
    entity: 'chance-qinglan',
    ready: () => true,
    lines: [
      '林道旁擱著一只藥箱。穿白衣的女子正壓住旅人的傷口，抬頭請你遞過乾淨布條。',
      '我是沈青蘭。幫我按住這裡，別鬆手。你若有金創藥，借我一份；沒有也沒關係，乾淨布條也能用。',
      '你一個人在這裡替人治傷？林子裡還有拿刀攔路的。',
      '看見了。他們早上還想搶藥箱。我讓頭目看看自己腿上的膿，他現在比誰都怕我走。',
      '把袖口捲起來，別碰到傷口。最上面只剩兩卷布條了，你幫我遞一下。',
    ],
    beats: [
      { shot: 'wide' },
      { shot: 'speaker' },
      { shot: 'player', portrait: 'player', speaker: '你' },
      { shot: 'speaker' },
      { shot: 'two-shot' },
    ],
    choices: [
      {
        id: 'medicine',
        label: '交出金創藥，幫她包紮',
        cost: 'herb',
        reward: 'tonic',
        trust: 3,
        result: '青蘭記下你的名號，回贈一包養氣散。她請你下次路過時再來坐坐。',
      },
      {
        id: 'cloth',
        label: '洗淨雙手，替她整理布條',
        reward: 'tonic',
        trust: 2,
        result: '你幫青蘭整理好布條。她分你一包養氣散，笑說兩個人總比一個人忙得過來。',
      },
    ],
  },
  {
    id: 'medicine-scent',
    title: '夜裡的藥香',
    companion: 'qinglan',
    map: 'forest',
    entity: 'chance-qinglan',
    ready: (s) => seen(s, 'medicine-box') && !['arrival', 'trial'].includes(s.quest),
    lines: [
      '再到藥箱旁，青蘭已把傷者安置好。她遞來熱茶，卻盯著一包幾乎沒有藥味的粉末。',
      '春生堂的藥。掌櫃保證能治舊傷，昨晚那位老人吃了卻連站都站不起來。我師父以前也收過這種藥。',
      '你師父後來怎麼樣？',
      '沒救回來。我把那包藥留了三年，問過的人都勸我算了。可包藥的印記換了，裡面的粉末還是一樣。',
      '先喝茶，已經不燙了。你若去洛陽，我想一起去。那個掌櫃欠我一句實話。',
    ],
    beats: [
      { shot: 'two-shot' },
      { shot: 'detail' },
      { shot: 'player', portrait: 'player', speaker: '你' },
      { shot: 'speaker' },
      { shot: 'two-shot' },
    ],
    choices: [
      {
        id: 'help',
        label: '先陪她分藥，再聽她說洛陽的事',
        reward: 'herb',
        trust: 3,
        result: '你替青蘭分好藥包。她留給你一份金創藥，也約你下山時一起去洛陽查藥。',
      },
      {
        id: 'ask',
        label: '記下藥堂名字，請她保存這包藥',
        reward: 'herb',
        trust: 2,
        result: '青蘭封好藥包，準備留作證據。你帶走一份金創藥，記下春生堂的名字。',
      },
    ],
  },
  {
    id: 'hidden-letter',
    title: '舊箱藏信',
    companion: 'tangwan',
    map: 'forest',
    entity: 'chance-tangwan',
    ready: () => true,
    lines: [
      '岔路石下壓著一封信。你剛俯身，樹後便伸出一隻手，搶先按住信角。',
      '別急，那是我的。唐晚，記好了。看這塊火漆，缺了半邊。我只取這封信，旁邊木箱裡的東西，你自己拿。',
      '一封塞在石頭底下的信，你怎麼證明是你的？',
      '火漆裡壓了半枚銅錢，另一半在我這兒。要不要連我的荷包也查一遍？先說好，查完得幫我把繩子繫回去。',
      '她把半枚銅錢放在信上，缺口正好對齊。信封寫著洛陽南市，收信人的名字已被雨水泡開。',
    ],
    beats: [
      { shot: 'wide' },
      { shot: 'speaker' },
      { shot: 'player', portrait: 'player', speaker: '你' },
      { shot: 'speaker' },
      { shot: 'detail' },
    ],
    choices: [
      {
        id: 'trust',
        label: '讓她收好信，問她要去哪裡',
        trust: 3,
        result: '唐晚收起信，約你到了洛陽去南市找她。她說有個人欠她一個交代。',
      },
      {
        id: 'check',
        label: '請她核對火漆，再把信交還',
        trust: 2,
        result: '唐晚耐著性子核對火漆。「警覺些也好。洛陽南市見，可別認錯人。」',
      },
    ],
  },
  {
    id: 'borrowed-umbrella',
    title: '借傘的人',
    companion: 'tangwan',
    map: 'forest',
    entity: 'chance-tangwan',
    ready: (s) =>
      seen(s, 'hidden-letter') && ['investigate', 'boss', 'return', 'complete'].includes(s.quest),
    lines: [
      '怎麼，還真記得回來？我還以為全真的門一關，你就忘了山下的人。瞧這把傘，骨架修好了，扣子還沒弄好。',
      '你在等我？',
      '等雨。順便等個會修傘扣的人，這根線快斷了，你手穩不穩？先別拽，我還指望它擋雨呢。',
      '那封信是給我姐姐的。她三年前去了洛陽，後來寄來的信只寫平安。可平安的人，為什麼連住哪裡都不肯告訴我？',
      '我得去山口接送信的人。你陪我走一段，還是幫我扣好這根鬆線，到了洛陽再見？',
    ],
    beats: [
      { shot: 'two-shot' },
      { shot: 'player', portrait: 'player', speaker: '你' },
      { shot: 'speaker' },
      { shot: 'detail' },
      { shot: 'two-shot' },
    ],
    choices: [
      {
        id: 'walk',
        label: '陪她走到山口，問問那封信',
        trust: 3,
        result: '你陪唐晚走了一段，記下姐姐最後來信的日子。她請你到了洛陽也幫她留意。',
      },
      {
        id: 'wait',
        label: '幫她修好傘扣，約定洛陽再見',
        trust: 2,
        result: '你扣好傘上的鬆線。唐晚說洛陽要是下雨，就一起借這把傘，這回不收你的錢。',
      },
    ],
  },
  {
    id: 'stone-song',
    title: '石碑下的曲子',
    companion: 'suyin',
    map: 'mountain',
    entity: 'chance-suyin',
    ready: () => true,
    lines: [
      '中央石徑旁壓著半頁曲譜。女子收起短笛，伸手把被風吹翻的紙角壓住。',
      '溫素音。這段曲子二十年前在山下唱過。老人一聽便會接下一句，可問起從哪裡學的，人人又說不記得。',
      '你為什麼非要找出後面的詞？',
      '我師父教我的時候，最後一句是空的。有人說曲子招魂，我卻只聽見有人在等家人回來。我想知道，到底哪一句讓人不敢再唱。',
      '坐吧，這塊石頭乾淨。山門那邊的鐘還沒響，你應該趕得及回去。',
    ],
    beats: [
      { shot: 'wide' },
      { shot: 'speaker' },
      { shot: 'player', portrait: 'player', speaker: '你' },
      { shot: 'speaker' },
      { shot: 'two-shot' },
    ],
    choices: [
      {
        id: 'listen',
        label: '坐下聽完，幫她記下缺失的詞',
        trust: 3,
        result: '你聽完素音的曲子，記住了「舊雨不歸人」一句。她說若尋到舊字跡，可以再來對照。',
      },
      {
        id: 'ask',
        label: '詢問這首曲子和禁地有什麼關係',
        trust: 2,
        result:
          '素音說曲子記的是失去親人的人，並非還魂的法子。她請你若見到舊手札，保留其中的字跡。',
      },
    ],
  },
  {
    id: 'missing-inscription',
    title: '缺字的碑文',
    companion: 'suyin',
    map: 'mountain',
    entity: 'chance-suyin',
    ready: (s) =>
      seen(s, 'stone-song') &&
      (s.inventory.journal > 0 || ['return', 'complete'].includes(s.quest)),
    lines: [
      '素音把曲譜攤在石上。看過你帶來的線索，她用指尖指出兩個相同的字。',
      '字跡對得上。這裡寫的是歸，不是魂。有人把舊曲抄成藥方，連這個字都改了。',
      '長恨用它讓旅人試藥。他要的那個人，已經死了二十年。',
      '可這曲子原本是唱給活人聽的。我把改過的字抄在旁邊了。這張紙會留著，往後有人再說招魂，就讓他看原件。',
      '洛陽有一本舊曲簿，我想去借。你若也往那裡走，下次見面，我把後半段唱給你聽。先幫我看看這兩行，有沒有漏字？',
    ],
    beats: [
      { shot: 'two-shot' },
      { shot: 'detail' },
      { shot: 'player', portrait: 'player', speaker: '你' },
      { shot: 'speaker' },
      { shot: 'two-shot' },
    ],
    choices: [
      {
        id: 'compare',
        label: '陪她對照字跡，抄下完整一節',
        reward: 'tonic',
        trust: 3,
        result: '你和素音抄好一節曲詞。她分你一包養氣散，約在洛陽再找這曲子的後半段。',
      },
      {
        id: 'preserve',
        label: '先收好原件，提醒她別獨自查訪',
        reward: 'tonic',
        trust: 2,
        result: '素音收好原件，答應先查公開的舊曲簿。她留給你一包養氣散，說下山前還可以再聽一遍。',
      },
    ],
  },
];

export function encounterRecords(state: GameState) {
  return CHANCE_ENCOUNTERS.flatMap((event) =>
    event.choices
      .filter((choice) => state.flags.includes(`chance:${event.id}:${choice.id}`))
      .map((choice) => ({ event, choice })),
  );
}
export function companionProgress(state: GameState, id: CompanionId) {
  const records = encounterRecords(state).filter(({ event }) => event.companion === id);
  const trust = records.reduce((sum, { choice }) => sum + choice.trust, 0);
  return { trust, stage: records.length === 0 ? '未相識' : trust >= 5 ? '熟識' : '相識', records };
}
/** 回訪只提示已相識人物的下一步，不提前揭露未遇見的名字。 */
export function companionMeeting(state: GameState, id: CompanionId) {
  const person = FIRST_COMPANIONS.find((c) => c.id === id)!;
  const pending = CHANCE_ENCOUNTERS.find(
    (event) => event.companion === id && !seen(state, event.id),
  );
  if (!pending) {
    return { ready: false, text: '第一章的兩次相逢已記下。下一次約定在洛陽，後續章節尚未開放。' };
  }
  if (pending.ready(state)) {
    return { ready: true, text: `有新的話題：${pending.title}。可到${person.hint}再訪。` };
  }
  const text =
    id === 'qinglan'
      ? '完成入門切磋後，再回松風林的藥箱旁找她。'
      : id === 'tangwan'
        ? '開始調查禁地後，再回松風林岔路找她。'
        : '找到禁地手札後，帶回後山與她對照曲譜。';
  return { ready: false, text };
}
export function encounterDialogue(state: GameState, entity: string): Dialogue | null {
  const companion = FIRST_COMPANIONS.find((c) => c.entity === entity && c.map === state.map);
  if (!companion) {
    return null;
  }
  const event = CHANCE_ENCOUNTERS.find(
    (e) => e.entity === entity && !seen(state, e.id) && e.ready(state),
  );
  const progress = companionProgress(state, companion.id);
  return {
    speaker: companion.name,
    role: `${companion.role} · ${event?.title ?? progress.stage}`,
    portrait: `portrait:${companion.id}`,
    beats: event?.beats,
    lines: event?.lines ?? [
      progress.records.at(-1)?.choice.result ?? '她暫時不在這裡。',
      companionMeeting(state, companion.id).text,
    ],
    choices: event
      ? [
          ...event.choices
            .filter((c) => !c.cost || state.inventory[c.cost] > 0)
            .map((c) => ({
              label: c.label,
              action: `chance:${event.id}:${c.id}`,
              note: c.cost
                ? `消耗金創藥 ×1${c.reward ? '，獲得養氣散 ×1' : ''}`
                : c.reward
                  ? `獲得${c.reward === 'herb' ? '金創藥' : '養氣散'} ×1`
                  : undefined,
            })),
          { label: '稍後再來', action: 'close' },
        ]
      : [{ label: '告辭', action: 'close' }],
  };
}
export function resolveEncounter(state: GameState, action: string): { message: string } | null {
  const [, id, choiceId] = action.split(':');
  const event = CHANCE_ENCOUNTERS.find((e) => e.id === id);
  const choice = event?.choices.find((c) => c.id === choiceId);
  if (
    !event ||
    !choice ||
    event.map !== state.map ||
    !event.ready(state) ||
    seen(state, id) ||
    (choice.cost && state.inventory[choice.cost] < 1)
  ) {
    return null;
  }
  if (choice.reward && state.inventory[choice.reward] >= 999) {
    return { message: '行囊中的藥品已滿，整理後再來。' };
  }
  if (choice.cost) {
    state.inventory[choice.cost]--;
  }
  if (choice.reward) {
    state.inventory[choice.reward]++;
  }
  state.flags.push(`chance:${id}:${choiceId}`);
  return { message: choice.result };
}
