import type {
  EncounterDefinition,
  EnemyDefinition,
  ItemDefinition,
  ItemId,
  QuestStage,
  Route,
  Skill,
} from '../game/types';

export const ITEMS: Record<ItemId, ItemDefinition> = {
  herb: {
    name: '金創藥',
    kind: 'medicine',
    description: '止血生肌，恢復 45 點生命。',
    price: 15,
    hp: 45,
  },
  tonic: {
    name: '養氣散',
    kind: 'medicine',
    description: '調息養氣，恢復 20 點內力。',
    price: 18,
    mp: 20,
  },
  elixir: {
    name: '回春丹',
    kind: 'medicine',
    description: '恢復 90 點生命與 20 點內力。',
    price: 40,
    hp: 90,
    mp: 20,
  },
  sword: {
    name: '青鋒劍',
    kind: 'weapon',
    description: '門中弟子使用的長劍。攻擊 +5。',
    price: 45,
    attack: 5,
  },
  wraps: {
    name: '玄布護手',
    kind: 'weapon',
    description: '纏裹雙拳，出招更穩。攻擊 +5。',
    price: 45,
    attack: 5,
  },
  robe: {
    name: '全真道袍',
    kind: 'armor',
    description: '素色道袍，防禦 +3。',
    price: 30,
    defense: 3,
  },
  armor: {
    name: '軟皮護甲',
    kind: 'armor',
    description: '出門遠行的護身衣。防禦 +6。',
    price: 65,
    defense: 6,
  },
  jade: {
    name: '無字玉佩',
    kind: 'quest',
    description: '師父贈予的玉佩。提醒你有所為，有所不為。',
    price: 0,
  },
  letter: {
    name: '山賊口供',
    kind: 'quest',
    description: '記下了後山夜間傳來怪聲的線索。',
    price: 0,
  },
  flower: {
    name: '山間青蘭',
    kind: 'quest',
    description: '蘇師兄尋找的藥草，生於山路石旁。',
    price: 0,
  },
  wine: { name: '遺落的酒壺', kind: 'quest', description: '壺身刻著一個「風」字。', price: 0 },
  journal: {
    name: '殘缺手札',
    kind: 'quest',
    description: '洪長恨留下的筆記，記錄著救回靈姍的執念。',
    price: 0,
  },
};

export const SKILLS: Record<Route, Skill[]> = {
  sword: [
    {
      id: 'pierce',
      limbs: { hands: 1, legs: 0 },
      name: '清風破甲',
      description: '造成傷害，降低目標防禦，持續至其兩次行動結束。',
      cost: 6,
      multiplier: 1.1,
      effect: 'break',
    },
    {
      id: 'swordfall',
      limbs: { hands: 2, legs: 0 },
      name: '落雁一劍',
      description: '凝聚劍氣，造成 1.85 倍攻擊傷害。',
      cost: 10,
      multiplier: 1.85,
    },
  ],
  fist: [
    {
      id: 'guard',
      limbs: { hands: 1, legs: 0 },
      name: '抱元守一',
      description: '減傷至下次行動，期間受到攻擊時反擊。',
      cost: 5,
      multiplier: 0,
      effect: 'counter',
    },
    {
      id: 'dragon',
      limbs: { hands: 2, legs: 0 },
      name: '伏龍掌',
      description: '運勁出掌，造成 1.8 倍攻擊傷害。',
      cost: 9,
      multiplier: 1.8,
    },
  ],
};

export const INNER_ARTS: Record<Route, { name: string; description: string }> = {
  sword: { name: '清心訣', description: '攻擊 +2，身法 +2。劍意清明，先發制人。' },
  fist: { name: '抱元功', description: '生命上限 +15，防禦 +2。氣沉丹田，穩中求勝。' },
};

export const ENEMIES: Record<string, EnemyDefinition> = {
  disciple: {
    name: '試招弟子',
    maxHp: 42,
    maxMp: 0,
    attack: 10,
    defense: 3,
    speed: 6,
    color: 0x7eaa9e,
    xp: 25,
    gold: 12,
    heavyEvery: 3,
  },
  bandit: {
    name: '山道刀客',
    maxHp: 52,
    maxMp: 0,
    attack: 15,
    defense: 4,
    speed: 8,
    color: 0xb2785d,
    xp: 30,
    gold: 18,
    heavyEvery: 3,
  },
  zombie: {
    name: '失心傀儡',
    maxHp: 65,
    maxMp: 0,
    attack: 17,
    defense: 5,
    speed: 5,
    color: 0x84946b,
    xp: 40,
    gold: 20,
    heavyEvery: 2,
  },
  boss: {
    name: '洪長恨',
    maxHp: 180,
    maxMp: 0,
    attack: 25,
    defense: 7,
    speed: 9,
    color: 0x995e63,
    xp: 100,
    gold: 65,
    heavyEvery: 3,
  },
};

export const ENCOUNTERS: Record<string, EncounterDefinition> = {
  trial: { name: '門前試招', enemies: ['disciple'], escapable: false },
  bandits: { name: '林間刀影', enemies: ['bandit', 'bandit'], escapable: false },
  patrol: { name: '迷途刀客', enemies: ['bandit'], escapable: true },
  undead: { name: '洞中異響', enemies: ['zombie', 'zombie'], escapable: false },
  boss: { name: '一念成執', enemies: ['boss'], escapable: false },
};

export const QUESTS: Record<QuestStage, { title: string; detail: string; region: string }> = {
  arrival: {
    title: '山門初見',
    detail: '穿過松風林，前往全真派，與徐長卿交談。',
    region: '全真派',
  },
  trial: { title: '以武會友', detail: '在演武場與試招弟子切磋，熟悉你的招式。', region: '全真派' },
  report: { title: '拜入全真', detail: '切磋已畢，向主殿前的上真道長回報。', region: '全真派' },
  bandits: {
    title: '林間疑雲',
    detail: '回松風林處理山賊事件。受傷的山賊似乎有話想說。',
    region: '松風林',
  },
  investigate: {
    title: '後山禁地',
    detail: '沿後山石階進入洞穴，調查遺落的手札。',
    region: '藏霧洞',
  },
  boss: { title: '一念成執', detail: '穿過傀儡守住的通道，與洪長恨對質。', region: '藏霧洞' },
  return: { title: '歸山問道', detail: '真相已明，回全真派向上真道長覆命。', region: '全真派' },
  complete: {
    title: '江湖未遠',
    detail: '第一章已完成。仍可自由探索、完成支線與整理行囊。',
    region: '啟程洛陽',
  },
};
