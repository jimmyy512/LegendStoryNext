import type { Battle } from '../../game/battle';
import type { Skill } from '../../game/types';

export function battleSkillStatus(battle: Battle, skill: Skill) {
  const power = battle.skillPower(skill.id);
  const queued = battle.queuedAction?.type === 'skill' && battle.queuedAction.skill === skill.id;
  const casting = battle.strike?.action.type === 'skill' && battle.strike.action.skill === skill.id;
  const enabled = !battle.result && power > 0 && battle.player.mp >= skill.cost;
  const purpose =
    skill.effect === 'counter' ? '護體反擊' : skill.effect === 'break' ? '破甲' : '重擊';
  const status =
    power === 0
      ? '肢體失能 · 無法施放'
      : casting
        ? '施放中'
        : battle.player.mp < skill.cost
          ? `內力不足 · 需 ${skill.cost}`
          : queued
            ? '已預備'
            : power < 1
              ? `發揮 ${Math.round(power * 100)}% · 內力 ${skill.cost}`
              : `${purpose} · 內力 ${skill.cost}`;
  return { enabled, active: power > 0 && (queued || casting), title: `${skill.name}\n${status}` };
}
