import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { createGame } from '../src/game/state';
import { SKILLS } from '../src/data/content';
import { battleSkillStatus } from '../src/ui/canvas/battleSkillStatus';

describe('skill readiness explanation', () => {
  it('tracks a real queued cast through resource consumption', () => {
    const battle = new Battle(createGame('旅人', 'sword'), 'trial');
    const skill = SKILLS.sword[1];
    battle.player.mp = skill.cost;
    expect(battle.act({ type: 'skill', skill: skill.id, target: 0 })).toBeNull();
    expect(battleSkillStatus(battle, skill).title).toContain('已預備');
    for (let tick = 0; tick < 200 && !battle.strike; tick++) {
      battle.update(0.05);
    }
    expect(battleSkillStatus(battle, skill).title).toContain('施放中');
    for (let tick = 0; tick < 100 && battle.strike; tick++) {
      battle.update(0.05);
    }
    expect(battle.player.mp).toBe(0);
    expect(battleSkillStatus(battle, skill)).toMatchObject({ enabled: false });
    expect(battleSkillStatus(battle, skill).title).toContain('內力不足');
  });
  it('distinguishes usable one-hand skills from reduced two-hand techniques', () => {
    const battle = new Battle(createGame('旅人', 'sword'), 'trial');
    battle.player.body.rightArm = 0;
    expect(battleSkillStatus(battle, SKILLS.sword[0]).title).toContain('破甲 · 內力');
    expect(battleSkillStatus(battle, SKILLS.sword[1])).toMatchObject({ enabled: true });
    expect(battleSkillStatus(battle, SKILLS.sword[1]).title).toContain('發揮 50%');
    battle.player.body.leftArm = 0;
    expect(battleSkillStatus(battle, SKILLS.sword[1])).toMatchObject({ enabled: false });
    expect(battleSkillStatus(battle, SKILLS.sword[1]).title).toContain('肢體失能');
  });
  it('explains missing energy without falsely labelling it an injury', () => {
    const battle = new Battle(createGame('旅人', 'fist'), 'trial');
    battle.player.mp = 0;
    expect(battleSkillStatus(battle, SKILLS.fist[1])).toMatchObject({ enabled: false });
    expect(battleSkillStatus(battle, SKILLS.fist[1]).title).toContain('內力不足 · 需 9');
  });
});
