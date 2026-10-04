import type { Dialogue } from './story';
import type { GameState, MapEntity } from './types';

export type DialogueShot = 'wide' | 'two-shot' | 'speaker' | 'player' | 'detail';
export interface DialogueBeat {
  shot: DialogueShot;
  speaker?: string;
  portrait?: string;
}

/** 第一章的具名場景保留原任務入口，運鏡與人物說話依每一句編排。 */
export function chapterOneDialogue(state: GameState, entity: MapEntity): Dialogue | null {
  const player = (shot: DialogueShot = 'player'): DialogueBeat => ({
    shot,
    speaker: state.name,
    portrait: 'player',
  });
  const npc = (shot: DialogueShot = 'speaker'): DialogueBeat => ({ shot });
  if (entity.id === 'qing' && state.quest === 'arrival') {
    return {
      speaker: '徐長卿',
      role: '全真派 · 大師兄',
      lines: [
        `你是${state.name}？韓伯的信到了。師父等了你兩日，還以為你在林子裡迷了路。`,
        '韓伯死了。信是他出事前寫的。我到時屋子已經燒光，只找到這半封信，還有押藥車上的銅牌。',
        '……信上說，他怕有人來找你。銅牌先收好，別在山下逢人就問。敢燒屋滅口的人，不會只盯著一個老鏢師。',
        '我一路追到這裡，卻連他們使的招式都認不出來。我不想再晚一步。',
        '那就先跟我學怎麼活過第一招。演武場有個師弟，手快，也愛搶攻。別跟他賭誰先倒下，等他重擊出手再還擊。',
        '試完招來找師父。韓伯是全真的舊友，這封信，我們會查。',
      ],
      beats: [npc('two-shot'), player(), npc('detail'), player(), npc(), npc('two-shot')],
      choices: [
        { label: '先練好本事，再查銅牌', action: 'accept-trial', note: '前往演武場切磋' },
        {
          label: '我要找到殺韓伯的人',
          action: 'accept-trial-revenge',
          note: '記下復仇之誓，同樣先學出招',
        },
      ],
    };
  }
  if (entity.id === 'master' && state.quest === 'report') {
    return {
      speaker: '上真道長',
      role: '全真派 · 掌門',
      lines: [
        '長卿把信交給我了。韓平替門中護過鏢，十年前救下你時，還抱怨自己連孩子的飯量都算不準。',
        '他總把最好的一份留給我。出事前卻叫我走，說這趟鏢收了不該收的錢。',
        '藥車的銅牌，我認得這個記號。洛陽有人借我們的商路運貨。先別去闖藥堂，連誰收貨、誰下手都沒查清，去了只會讓他們換個地方。',
        state.flags.includes('revenge-vowed')
          ? '我知道你要報仇。這件道袍與兵器收好。能擋刀，能護身，才有機會把仇人留下來問話。'
          : '這件道袍與兵器收好。韓平託我們照看你，我不能讓你空著手再去追那輛車。',
        '松風林有幾個攔路刀客，扣過運藥的車。有人傷了腿，還躲在舊木箱附近。去問他那車往哪裡走。',
        '他們若肯說，留個活口；若動刀，就讓他們知道山道不歸他們管。問出的名字與貨單都帶回來，別只帶一句猜測。',
      ],
      beats: [npc('two-shot'), player(), npc('detail'), npc(), npc('wide'), npc()],
      choices: [{ label: '穿好行裝，下山查藥車', action: 'join', note: '獲得武器、道袍與補給' }],
    };
  }
  if (entity.id === 'wounded' && state.quest === 'bandits' && !state.flags.includes('mercy')) {
    return {
      speaker: '受傷的山賊',
      role: '松風林 · 傷者',
      lines: [
        '別拔刀！我腿上這傷不是跟你們打的。那輛藥車過林子時，我們想攔下問路，他們連話都沒說就動了手。',
        '車上有沒有一個姓韓的老鏢師？右手缺了一截小指。',
        '有。他叫我們別碰藥箱，還把半袋米丟下來。後頭的人嫌他多嘴，把他趕上車……後來我只看到林子那邊起火。',
        '把你看見的人說清楚。穿什麼，用什麼兵器？',
        '領頭的兩隻手包著銅片，車到了岔路就往東走。可晚上還有個穿全真道袍的人，把失神的旅人帶進後山。這兩撥人，我分得清。',
        '你有藥嗎？先把血止住，我才能勸兄弟們退開。你若只想動刀，頭目在前頭，我攔不住你。',
      ],
      beats: [npc('two-shot'), player(), npc('speaker'), player(), npc('detail'), npc('two-shot')],
      choices: [
        { label: '替他止血，換取口供', action: 'mercy', note: '金創藥 ×1，和平處理山賊事件' },
        { label: '找頭目問出貨單下落', action: 'seek-bandits', note: '前往挑戰山賊頭目' },
      ],
    };
  }
  if (entity.id === 'bandits') {
    return {
      speaker: '山賊頭目',
      role: '松風林 · 攔路者',
      lines: [
        '全真的新弟子？那老頭才給了你一身衣服，就讓你替他跑腿？把藥留著，免得等會兒沒人替你止血。',
        '我要藥車的貨單。你的人看見了押車的銅手，別再拿過路人出氣。',
        '貨單是我搶的，憑什麼交給你？別以為穿上道袍，手就比我穩。',
      ],
      beats: [npc('two-shot'), player(), npc()],
      choices: [
        { label: state.route === 'sword' ? '拔劍應戰' : '出掌應戰', action: 'battle:bandits' },
        { label: '暫且退開', action: 'close' },
      ],
    };
  }
  if (entity.id === 'journal' && state.quest === 'investigate') {
    return {
      speaker: '殘缺手札',
      role: '藏霧洞 · 線索',
      lines: [
        '「靈姍，若這世間還有一線生機，我便不信命。」下方列著失蹤旅人的名字，有幾個名字旁邊已經畫了叉。',
        '這是洪長恨的字。貨單上的春生堂也在這裡，交貨人只留了「季」字。韓伯押的藥車，原來送過這個洞。',
        '最後一頁記著下一批藥的日子，墨還沒乾。石臺另一側傳來腳步，有人一直在看你翻這本手札。',
      ],
      beats: [npc('detail'), player('detail'), npc('wide')],
      choices: [{ label: '收起手札，尋找長恨', action: 'journal' }],
    };
  }
  if (entity.id === 'boss' && state.defeated.includes('boss')) {
    return {
      speaker: '洪長恨',
      role: '藏霧洞 · 戰後',
      lines: [
        '我不再出手了。手札上的名字，是被我帶進洞裡的旅人。這些事，我得向他們的家人交代。',
        state.flags.includes('mercy')
          ? '你救了山下那個人，他才肯開口。我卻拿別人的命，賭她能不能回來。'
          : '禁術救不回靈姍。我知道再試下去還會死人，卻還逼那些旅人替我試。',
        '韓平不是我殺的。送藥的人叫季衡，兩手裹銅，他怕韓平認出貨物。去洛陽春生堂查他。帶上手札，回山吧，我做過的事也會親口交代。',
      ],
      beats: [npc('two-shot'), npc(), npc('detail')],
      choices: [{ label: '帶手札回山覆命', action: 'close' }],
    };
  }
  if (entity.id === 'boss' && state.defeated.includes('undead')) {
    return {
      speaker: '洪長恨',
      role: '全真派 · 二師兄',
      lines: [
        '手札放下。你不知道那上面寫的是什麼。',
        '我認得韓伯的貨單。你收的藥從哪裡來？那些被你帶進洞的人，還有幾個活著？',
        '我沒有叫他們殺韓平！季衡答應給我藥方，說只差最後一次……二十年了，我不能連試都不試。',
        '石臺上的名字被畫了叉。你每試一次，就讓一個人回不了家。',
        state.flags.includes('mercy')
          ? '山下那個人竟肯為你帶路。你才入門幾日，就想把我押回山？那便動手。'
          : '你能走過傀儡，不代表能攔住我。想拿這本手札，就憑自己的本事來拿。',
      ],
      beats: [npc('wide'), player(), npc('speaker'), player('detail'), npc()],
      choices: [
        {
          label: '奪下手札，制住長恨',
          action: 'battle:boss',
          note: '首領會蓄勢重擊，留意防禦與補給',
        },
        { label: '先做準備', action: 'close' },
      ],
    };
  }
  if (entity.id === 'master' && state.quest === 'return') {
    return {
      speaker: '上真道長',
      role: '全真派 · 掌門',
      lines: [
        '長恨回來了，失蹤旅人的名字也已抄下。我讓人去尋他們的家屬。門中的人犯了事，不能只在門裡關上門說幾句。',
        '他說押藥的人叫季衡。銅牌、貨單、手札上的日期都對得上，我要去洛陽。',
        '春生堂背後有商路和護衛，別照著山下那場架再打一遍。問貨、找人、摸清出入口，你已經知道怎麼把事情查下去。',
        state.flags.includes('mercy')
          ? '你救過的山賊已答應替我們帶路，尋回失蹤的旅人。他知道的貨單記號，也會交給照看家屬的人。'
          : '山道已通，貨單也帶回來了。被刀客攔過的人仍要安置，我會派門中弟子下山處理。',
        state.flags.includes('revenge-vowed')
          ? '韓伯的仇還沒報。我會讓季衡自己說出那晚發生的事，不會只聽長恨一面之詞。'
          : '我會找到季衡，把韓伯那趟鏢的事問清楚。也會查那些藥還送到了哪裡。',
        `這枚玉佩交給你。${state.name}，從前讓你守在師兄後面，如今我會把下山的事交給你。有人肯同行就互相照應，有事也可以回山找我們。`,
      ],
      beats: [npc('two-shot'), player(), npc(), npc('wide'), player(), npc('two-shot')],
      choices: [
        { label: '收好玉佩，準備前往洛陽', action: 'finish', note: '完成第一章，洛陽章節仍在製作' },
      ],
    };
  }
  return null;
}
