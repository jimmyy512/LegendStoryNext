import { ITEMS } from '../data/content';
import type { Battle } from './battle';
import { BODY_PARTS, PART_CAPACITY, PART_NAMES } from './body';
import { nextObjective, objectiveLabel } from './objectives';
import { settleBattle } from './story';
import type { ItemId } from './types';
import { earnedTalentPoints } from './talents';

/** Preview the existing settlement on a copy; rewards are applied only on leaving combat. */
export function battleOutcome(battle: Battle) {
  const before = battle.player;
  const after = structuredClone(before);
  settleBattle(after, battle);
  const won = battle.result === 'victory';
  const rewarded = won && !before.defeated.includes(battle.encounterId);
  const talentGain = earnedTalentPoints(after) - earnedTalentPoints(before);
  const wounds = BODY_PARTS.filter((part) => after.body[part] < PART_CAPACITY[part]);
  const next = nextObjective(after);
  const loot = (Object.keys(ITEMS) as ItemId[])
    .filter((id) => after.inventory[id] > before.inventory[id])
    .map((id) => `${ITEMS[id].name} ×${after.inventory[id] - before.inventory[id]}`);
  return {
    title: won
      ? battle.encounterId === 'trial'
        ? '切磋得勝'
        : '此戰告捷'
      : battle.result === 'escaped'
        ? '已脫離交鋒'
        : '此戰敗退',
    rewards: rewarded
      ? `銀兩 +${battle.reward.gold}　修為 +${battle.reward.xp}`
      : won
        ? '本場獎勵已領取'
        : '本場未獲得獎勵',
    growth:
      after.level > before.level
        ? `突破第 ${after.level} 重 · ${talentGain > 0 ? `天賦 +${talentGain}，於角色配置` : '生命與內力恢復'}`
        : after.level >= 10
          ? '第 10 重 · 已達目前境界上限'
          : `第 ${after.level} 重 · 修為 ${after.xp} / ${after.level * 60}`,
    progress: after.level >= 10 ? 1 : after.xp / (after.level * 60),
    loot: loot.join('、'),
    condition:
      battle.result === 'defeat'
        ? '返回後恢復狀態與本場消耗，可重新挑戰。'
        : wounds.length
          ? `${wounds.length === 1 ? PART_NAMES[wounds[0]] : `${wounds.length} 處部位`}受傷 · 回門派休息可恢復`
          : '各部位完好，可繼續前行。',
    next:
      battle.result === 'defeat'
        ? battle.enemies.filter((enemy) => enemy.hp > 0).length > 1
          ? '先集中擊倒一名對手；看到重擊蓄力時立即防禦。'
          : '留意敵人重擊蓄力；防禦後趁破綻施放招式。'
        : next
          ? `下一步 · ${objectiveLabel(next)}`
          : '主線已完成，可繼續探索江湖。',
    action: battle.result === 'defeat' ? '返回探索，重新整備' : '收招，返回探索',
  };
}
