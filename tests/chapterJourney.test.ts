import { mkdirSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { MAPS } from '../src/data/maps';
import { type BattleAction } from '../src/game/battle';
import { GameSession } from '../src/game/GameSession';
import { decodeSave, encodeSave } from '../src/game/save';
import { createGame } from '../src/game/state';
import type { MapId, Route } from '../src/game/types';

const balanceRecords: Record<string, string | number | boolean>[] = [];
afterAll(() => {
  if (process.env.CHAPTER_BALANCE === '1') {
    mkdirSync('.impeccable/review', { recursive: true });
    writeFileSync(
      '.impeccable/review/chapter-balance.json',
      JSON.stringify(balanceRecords, null, 2),
    );
  }
});

function randomSequence(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function choose(session: GameSession, id: string, action: string): void {
  const entity = MAPS[session.state!.map].entities.find((entry) => entry.id === id);
  expect(entity, `目前地區缺少 ${id}`).toBeDefined();
  const outcome = session.choose(entity!, action);
  if (outcome.battle) {
    session.startBattle(outcome.battle);
  }
}

function travel(session: GameSession, map: MapId): void {
  const portal = MAPS[session.state!.map].entities.find((entry) => entry.to === map)!;
  session.start(session.prepareTravel(portal));
}

function fight(session: GameSession): void {
  const battle = session.battle!;
  let actions = 0;
  let heavyTelegraphs = 0;
  while (!battle.result && actions++ < 100) {
    const target = battle.enemies.findIndex((enemy) => enemy.hp > 0);
    const danger = battle.enemies.some(
      (enemy, index) => enemy.hp > 0 && battle.intent(index).includes('重擊'),
    );
    let action: BattleAction;
    if (battle.player.hp < battle.stats.maxHp * 0.55 && battle.player.inventory.elixir > 0) {
      action = { type: 'item', item: 'elixir' };
    } else if (battle.player.hp < battle.stats.maxHp * 0.55 && battle.player.inventory.herb > 0) {
      action = { type: 'item', item: 'herb' };
    } else if (danger) {
      action = { type: 'defend' };
    } else if (battle.player.mp >= 10) {
      action = {
        type: 'skill',
        skill: battle.player.route === 'sword' ? 'swordfall' : 'dragon',
        target,
      };
    } else {
      action = { type: 'attack', target };
    }
    expect(session.act(action)).toBeNull();
    let ticks = 0;
    while (battle.queuedAction && !battle.result && ticks++ < 200) {
      const events = battle.update(0.05);
      heavyTelegraphs += events.filter((event) => event.kind === 'windup' && event.heavy).length;
    }
    expect(ticks).toBeLessThan(200);
  }
  expect(
    battle.result,
    `${battle.encounterId}, HP=${battle.player.hp}, body=${JSON.stringify(battle.player.body)}`,
  ).toBe('victory');
  if (process.env.CHAPTER_BALANCE === '1') {
    balanceRecords.push({
      route: battle.player.route,
      encounter: battle.encounterId,
      level: battle.player.level,
      equippedRewards: battle.player.headwear !== null,
      heavyTelegraphs,
      seconds: Math.round(battle.clock.elapsed * 10) / 10,
      healthRemaining: Math.round((battle.player.hp / battle.stats.maxHp) * 100),
      medicineUsed:
        session.state!.inventory.herb +
        session.state!.inventory.elixir -
        battle.player.inventory.herb -
        battle.player.inventory.elixir,
    });
  }
  session.finishBattle();
  // 模擬安全節點存讀檔，確保不是只靠同一份記憶體物件通關。
  session.start(decodeSave(encodeSave(session.state!)).state);
}

describe('第一章完整旅程的多亂數驗收', () => {
  for (const route of ['sword', 'fist'] as Route[]) {
    for (const branch of ['mercy', 'force']) {
      it.each(
        [1, 7, 42, 137, 2026, 9999, 31415, 65535].flatMap((seed) => [
          { seed, rewardEquipment: false },
          { seed, rewardEquipment: true },
        ]),
      )(`${route}/${branch} seed=$seed equipment=$rewardEquipment`, ({ seed, rewardEquipment }) => {
        const random = vi.spyOn(Math, 'random').mockImplementation(randomSequence(seed));
        try {
          const session = new GameSession();
          session.start(createGame('驗收旅人', route));
          choose(session, 'wine', 'pick-wine');
          choose(session, 'forest-chest', 'chest:forest-chest');
          if (rewardEquipment) {
            expect(session.changeItem('equip', 'strawHat')).toBe(true);
          }
          travel(session, 'temple');
          choose(session, 'fong', 'deliver-wine');
          if (rewardEquipment) {
            expect(session.changeItem('equip', 'swiftBoots')).toBe(true);
          }
          choose(session, 'qing', 'accept-trial');
          choose(session, 'trial', 'battle:trial');
          fight(session);
          choose(session, 'master', 'join');
          choose(session, 'yin', 'accept-flower');
          travel(session, 'forest');
          if (branch === 'mercy') {
            choose(session, 'wounded', 'mercy');
          } else {
            choose(session, 'bandits', 'battle:bandits');
            fight(session);
          }
          travel(session, 'temple');
          choose(session, 'master', 'rest');
          travel(session, 'mountain');
          choose(session, 'flower', 'pick-flower');
          choose(session, 'mountain-chest', 'chest:mountain-chest');
          if (rewardEquipment) {
            expect(session.changeItem('equip', 'guardPants')).toBe(true);
          }
          travel(session, 'temple');
          choose(session, 'yin', 'deliver-flower');
          travel(session, 'mountain');
          travel(session, 'cave');
          choose(session, 'cave-chest', 'chest:cave-chest');
          if (rewardEquipment) {
            expect(session.changeItem('equip', 'taoistCrown')).toBe(true);
          }
          choose(session, 'journal', 'journal');
          choose(session, 'undead', 'battle:undead');
          fight(session);
          // 治療必須實際回門派，不能在測試中憑空 restore。
          travel(session, 'mountain');
          travel(session, 'temple');
          choose(session, 'master', 'rest');
          travel(session, 'mountain');
          travel(session, 'cave');
          choose(session, 'boss', 'battle:boss');
          fight(session);
          travel(session, 'mountain');
          travel(session, 'temple');
          choose(session, 'master', 'finish');
          const ending = session.state!;
          expect(ending.quest).toBe('complete');
          expect(ending.flags).toEqual(expect.arrayContaining([branch, 'wine-done', 'herb-done']));
          expect(ending.opened).toHaveLength(3);
          expect(ending.inventory.jade).toBe(1);
          expect(decodeSave(encodeSave(ending)).state).toEqual(ending);
        } finally {
          random.mockRestore();
        }
      });
    }
  }
});
