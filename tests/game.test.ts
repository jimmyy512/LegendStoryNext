import { describe, expect, it } from 'vitest';
import { ENCOUNTERS, ITEMS, SKILLS } from '../src/data/content';
import { MAPS } from '../src/data/maps';
import { Battle, type BattleAction } from '../src/game/battle';
import { findPath, isWalkable } from '../src/game/pathfinding';
import { decodeSave, encodeSave } from '../src/game/save';
import { buy, createGame, equip, getStats, restore, sell, useMedicine } from '../src/game/state';
import { applyStoryAction, getDialogue, settleBattle } from '../src/game/story';
import type { GameState, Route } from '../src/game/types';

function playBattle(state: GameState, id: string): Battle {
  const battle = new Battle(state, id, () => 0);
  let turns = 0;
  while (!battle.result && turns++ < 60) {
    const target = battle.enemies.findIndex((enemy) => enemy.hp > 0);
    const danger = battle.enemies.some(
      (enemy, index) => enemy.hp > 0 && battle.intent(index).includes('重擊'),
    );
    let action: BattleAction;
    if (battle.player.hp < battle.stats.maxHp * 0.45 && battle.player.inventory.herb > 0) {
      action = { type: 'item', item: 'herb' };
    } else if (danger) {
      action =
        state.route === 'fist' && battle.player.mp >= 5
          ? { type: 'skill', skill: 'guard', target }
          : { type: 'defend' };
    } else if (battle.player.mp >= 10) {
      action = { type: 'skill', skill: state.route === 'sword' ? 'swordfall' : 'dragon', target };
    } else {
      action = { type: 'attack', target };
    }
    expect(battle.act(action)).toBeNull();
    while (battle.queuedAction && !battle.result) {
      battle.update(0.05);
    }
  }
  expect(turns).toBeLessThan(60);
  return battle;
}

describe('內容與地圖', () => {
  it('所有互動點、傳送出生點可到達，路徑不穿越障礙', () => {
    for (const map of Object.values(MAPS)) {
      const from = map.entities.find((entity) => entity.kind === 'portal')!;
      expect(isWalkable(map, from), map.id).toBe(true);
      for (const entity of map.entities) {
        expect(isWalkable(map, entity), `${map.id}/${entity.id}`).toBe(true);
        const path = findPath(map, from, entity);
        expect(path.length > 0 || entity === from, entity.id).toBe(true);
        for (const point of path) {
          expect(isWalkable(map, point)).toBe(true);
        }
        if (entity.to) {
          expect(isWalkable(MAPS[entity.to], entity.spawn!)).toBe(true);
        }
        if (entity.encounter) {
          expect(ENCOUNTERS[entity.encounter]).toBeDefined();
        }
      }
    }
  });
  it('障礙、地圖外與無效座標不可通行', () => {
    expect(findPath(MAPS.temple, { x: 2, y: 11 }, { x: 10, y: 2 })).toEqual([]);
    expect(isWalkable(MAPS.forest, { x: 24, y: 7 })).toBe(false);
    expect(isWalkable(MAPS.forest, { x: 3.5, y: 7 })).toBe(false);
  });
});

describe('半即時戰鬥', () => {
  it('身法高的敵人先行動，死亡敵人不再行動', () => {
    const state = createGame('測試', 'fist');
    const battle = new Battle(state, 'boss');
    battle.paused = false;
    battle.update(2.3);
    expect(battle.player.hp).toBeLessThan(state.hp);
    expect(battle.playerProgress).toBeLessThan(1);
    const trial = new Battle(createGame('劍客', 'sword'), 'trial');
    trial.enemies[0].hp = 1;
    trial.act({ type: 'attack', target: 0 });
    trial.update(2.3);
    expect(trial.result).toBe('victory');
    expect(trial.player.hp).toBe(100);
  });
  it('防禦減傷持續到下次行動，之後正常承傷', () => {
    const state = createGame('劍客', 'sword');
    const guarded = new Battle(state, 'trial');
    const ordinary = new Battle(state, 'trial');
    guarded.act({ type: 'defend' });
    guarded.update(2.5);
    ordinary.act({ type: 'attack', target: 0 });
    ordinary.update(2.5);
    expect(guarded.player.hp).toBeGreaterThan(ordinary.player.hp);
    const before = guarded.player.hp;
    guarded.act({ type: 'attack', target: 0 });
    guarded.update(2.5);
    expect(before - guarded.player.hp).toBe(100 - ordinary.player.hp);
  });
  it('反擊會傷害攻擊者，技能扣除內力', () => {
    const battle = new Battle(createGame('拳客', 'fist'), 'trial');
    battle.act({ type: 'skill', skill: 'guard', target: 0 });
    battle.update(2.5);
    expect(battle.enemies[0].hp).toBeLessThan(42);
    expect(battle.player.mp).toBe(30);
    expect(battle.events.some((event) => event.text.includes('護體反擊'))).toBe(true);
  });
  it('破甲提高後續傷害，並依目標行動次數消退', () => {
    const battle = new Battle(createGame('劍客', 'sword'), 'boss');
    battle.act({ type: 'skill', skill: 'pierce', target: 0 });
    battle.update(2.5);
    expect(battle.enemies[0].broken).toBe(1);
    const hp = battle.enemies[0].hp;
    battle.act({ type: 'attack', target: 0 });
    battle.update(2.5);
    expect(hp - battle.enemies[0].hp).toBeGreaterThan(Math.round(19 - 7 * 0.65));
    expect(battle.enemies[0].broken).toBe(0);
  });
  it('無效指令不消耗回合、內力與物品', () => {
    const state = createGame('劍客', 'sword');
    const battle = new Battle(state, 'trial');
    expect(battle.act({ type: 'item', item: 'herb' })).toBeTruthy();
    expect(battle.act({ type: 'attack', target: 9 })).toBeTruthy();
    expect(battle.act({ type: 'escape' })).toBeTruthy();
    battle.player.mp = 0;
    expect(battle.act({ type: 'skill', skill: 'pierce', target: 0 })).toBeTruthy();
    expect(battle.clock.elapsed).toBe(0);
    expect(battle.enemies[0].actions).toBe(0);
    expect(battle.player.inventory.herb).toBe(state.inventory.herb);
  });
  it('逃跑成功不發獎勵，失敗會讓敵人行動', () => {
    const state = createGame('旅人', 'sword');
    const success = new Battle(state, 'patrol', () => 0);
    success.act({ type: 'escape' });
    success.update(2.5);
    expect(success.result).toBe('escaped');
    settleBattle(state, success);
    expect(state.gold).toBe(35);
    expect(state.defeated).toEqual([]);
    const failure = new Battle(state, 'patrol', () => 0.99);
    failure.act({ type: 'escape' });
    failure.update(2.5);
    expect(failure.result).toBeNull();
    expect(failure.player.hp).toBeLessThan(state.hp);
  });
});

describe('主線、支線與獎勵', () => {
  for (const route of ['sword', 'fist'] as Route[]) {
    for (const branch of ['mercy', 'force']) {
      it(`${route}/${branch} 可以完成第一章並讀回正確結局`, () => {
        const state = createGame('測試俠客', route);
        applyStoryAction(state, 'accept-trial');
        const trial = playBattle(state, 'trial');
        expect(trial.result).toBe('victory');
        settleBattle(state, trial);
        expect(state.quest).toBe('report');
        applyStoryAction(state, 'join');
        expect(state.weapon).toBe(route === 'sword' ? 'sword' : 'wraps');
        if (branch === 'mercy') {
          applyStoryAction(state, 'mercy');
        } else {
          const battle = playBattle(state, 'bandits');
          expect(battle.result).toBe('victory');
          settleBattle(state, battle);
        }
        expect(state.quest).toBe('investigate');
        expect(state.flags).toContain(branch);
        applyStoryAction(state, 'pick-flower');
        applyStoryAction(state, 'deliver-flower');
        applyStoryAction(state, 'pick-wine');
        applyStoryAction(state, 'deliver-wine');
        applyStoryAction(state, 'chest:forest-chest');
        applyStoryAction(state, 'chest:mountain-chest');
        applyStoryAction(state, 'chest:cave-chest');
        restore(state);
        applyStoryAction(state, 'journal');
        const undead = playBattle(state, 'undead');
        expect(undead.result).toBe('victory');
        settleBattle(state, undead);
        restore(state);
        const boss = playBattle(state, 'boss');
        expect(boss.result).toBe('victory');
        settleBattle(state, boss);
        expect(state.quest).toBe('return');
        const master = MAPS.temple.entities.find((entity) => entity.id === 'master')!;
        expect(getDialogue(state, master).lines.join('')).toContain(
          branch === 'mercy' ? '救過' : '山道已通',
        );
        applyStoryAction(state, 'finish');
        expect(state.quest).toBe('complete');
        expect(decodeSave(encodeSave(state)).state).toEqual(state);
      });
    }
  }
  it('重複交付、開箱、結算與完成章節不重複給獎', () => {
    const state = createGame('旅人', 'sword');
    applyStoryAction(state, 'pick-flower');
    applyStoryAction(state, 'deliver-flower');
    applyStoryAction(state, 'chest:forest-chest');
    const trial = playBattle(state, 'trial');
    settleBattle(state, trial);
    state.quest = 'return';
    applyStoryAction(state, 'finish');
    const snapshot = structuredClone(state);
    for (let i = 0; i < 3; i++) {
      applyStoryAction(state, 'pick-flower');
      applyStoryAction(state, 'deliver-flower');
      applyStoryAction(state, 'chest:forest-chest');
      settleBattle(state, trial);
      applyStoryAction(state, 'finish');
    }
    expect(state).toEqual(snapshot);
  });
  it('戰敗可重試且不扣藥、不領取獎勵', () => {
    const state = createGame('旅人', 'fist');
    const battle = new Battle(state, 'boss');
    battle.player.inventory.herb--;
    battle.player.hp = 0;
    battle.result = 'defeat';
    settleBattle(state, battle);
    expect(state.inventory.herb).toBe(3);
    expect(state.defeated).toEqual([]);
    expect(state.hp).toBe(getStats(state).maxHp);
  });
});

describe('背包與交易', () => {
  it('交易扣款正確，任務物品與穿著中的最後一件裝備不可出售', () => {
    const state = createGame('旅人', 'sword');
    expect(buy(state, 'armor')).toBe(false);
    expect(buy(state, 'robe')).toBe(true);
    expect(state.gold).toBe(5);
    expect(equip(state, 'robe')).toBe(true);
    expect(sell(state, 'robe')).toBe(false);
    state.inventory.jade = 1;
    expect(sell(state, 'jade')).toBe(false);
    expect(sell(state, 'herb')).toBe(true);
    expect(state.gold).toBe(12);
    state.inventory.wraps = 1;
    expect(equip(state, 'wraps')).toBe(false);
  });
  it('滿血不浪費藥品，補量不超過上限', () => {
    const state = createGame('旅人', 'fist');
    expect(useMedicine(state, 'herb')).toBe(false);
    state.hp -= 2;
    expect(useMedicine(state, 'herb')).toBe(true);
    expect(state.hp).toBe(getStats(state).maxHp);
    expect(state.inventory.herb).toBe(2);
  });
});

type InvalidSaveState = Record<string, unknown> & { inventory: Record<string, unknown> };

describe('存檔驗證', () => {
  it('保留選擇與完整資料，與原物件沒有共享參考', () => {
    const state = createGame('<旅人>', 'sword');
    state.flags.push('mercy');
    const read = decodeSave(encodeSave(state));
    expect(read.state).toEqual(state);
    read.state.gold++;
    expect(state.gold).toBe(35);
  });
  it.each([
    (state: InvalidSaveState) => {
      state.version = 99;
    },
    (state: InvalidSaveState) => {
      state.gold = -1;
    },
    (state: InvalidSaveState) => {
      state.inventory.herb = '3';
    },
    (state: InvalidSaveState) => {
      delete state.inventory.tonic;
    },
    (state: InvalidSaveState) => {
      state.position = { x: 4, y: 3 };
    },
    (state: InvalidSaveState) => {
      state.hp = 999999;
    },
    (state: InvalidSaveState) => {
      state.weapon = 'sword';
    },
    (state: InvalidSaveState) => {
      state.map = 'missing';
    },
    (state: InvalidSaveState) => {
      state.flags = ['mercy', 'mercy'];
    },
  ])('拒絕壞存檔而不改動目前狀態 (%#)', (mutate) => {
    const state = createGame('旅人', 'sword');
    const invalid: InvalidSaveState = JSON.parse(JSON.stringify(state));
    mutate(invalid);
    expect(() =>
      decodeSave(JSON.stringify({ savedAt: new Date().toISOString(), state: invalid })),
    ).toThrow();
    expect(state).toEqual(createGame('旅人', 'sword'));
  });
  it('所有道具與武學都有有效說明與價格', () => {
    for (const item of Object.values(ITEMS)) {
      expect(item.description.length).toBeGreaterThan(0);
    }
    for (const skills of Object.values(SKILLS)) {
      for (const skill of skills) {
        expect(skill.cost).toBeGreaterThan(0);
      }
    }
  });
});
