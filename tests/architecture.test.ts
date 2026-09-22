import { describe, expect, it, vi } from 'vitest';
import { SceneManager } from '../src/core/SceneManager';
import { TransitionController } from '../src/core/TransitionController';
import { MAPS } from '../src/data/maps';
import { GameSession } from '../src/game/GameSession';
import { encodeSave } from '../src/game/save';
import { createGame } from '../src/game/state';
import { AssetService } from '../src/services/AssetService';
import { SaveRepository } from '../src/services/SaveRepository';

describe('scene ownership', () => {
  it('disposes the previous scene exactly once and updates only the active scene', () => {
    const manager = new SceneManager();
    const first = { update: vi.fn(), dispose: vi.fn() };
    const second = { update: vi.fn(), dispose: vi.fn() };
    manager.replace(() => first);
    manager.update(0.1);
    manager.replace(() => second);
    manager.update(0.2);
    manager.dispose();
    manager.dispose();
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).toHaveBeenCalledTimes(1);
    expect(first.update).toHaveBeenCalledExactlyOnceWith(0.1);
    expect(second.update).toHaveBeenCalledExactlyOnceWith(0.2);
  });

  it('keeps the original scene when the replacement cannot be constructed', () => {
    const manager = new SceneManager();
    const scene = { update: vi.fn(), dispose: vi.fn() };
    manager.replace(() => scene);
    expect(() =>
      manager.replace(() => {
        throw new Error('broken scene');
      }),
    ).toThrow();
    manager.update(1);
    expect(scene.dispose).not.toHaveBeenCalled();
    expect(scene.update).toHaveBeenCalledWith(1);
  });
});

describe('transactional scene loading', () => {
  function fixture(retry = false) {
    const view = { show: vi.fn(), hide: vi.fn(), askRetry: vi.fn(async () => retry) };
    return { view, controller: new TransitionController(view) };
  }

  it('does not commit failed or cancelled preparation', async () => {
    const { view, controller } = fixture();
    const commit = vi.fn();
    expect(
      await controller.run({
        label: 'test',
        prepare: async () => {
          throw new Error('offline');
        },
        commit,
      }),
    ).toBe(false);
    expect(commit).not.toHaveBeenCalled();
    expect(view.hide).toHaveBeenCalledOnce();
    expect(controller.busy).toBe(false);
  });

  it('retries preparation and commits only once', async () => {
    const { controller } = fixture(true);
    const prepare = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const commit = vi.fn();
    await controller.run({ label: 'test', prepare, commit });
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledOnce();
  });

  it('ignores repeated transitions until loading and cleanup finish', async () => {
    const { controller } = fixture();
    let finish!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const commit = vi.fn();
    const first = controller.run({
      label: 'first',
      prepare: async () => {},
      commit,
      afterCommit: () => cleanup,
    });
    expect(await controller.run({ label: 'second', prepare: async () => {}, commit })).toBe(false);
    expect(controller.busy).toBe(true);
    finish();
    await first;
    expect(commit).toHaveBeenCalledOnce();
    expect(controller.busy).toBe(false);
  });
});

describe('resource lifetime', () => {
  it('retains old textures until commit, shares common assets and reloads released maps', async () => {
    const backend = {
      loadBundle: vi.fn(async (_name: string, progress: (value: number) => void) => {
        progress(1);
      }),
      unloadBundle: vi.fn(async (_name: string) => {}),
    };
    const service = new AssetService(backend);
    const progress = vi.fn();
    await service.prepare('forest', progress);
    await service.commit('forest');
    await service.prepare('temple', progress);
    expect(backend.unloadBundle).not.toHaveBeenCalled();
    await service.commit('temple');
    expect(backend.unloadBundle).toHaveBeenCalledExactlyOnceWith('map:forest');
    await service.prepare('forest', progress);
    expect(backend.loadBundle.mock.calls.map(([name]) => name)).toEqual([
      'common',
      'map:forest',
      'map:temple',
      'map:forest',
    ]);
    expect(progress).toHaveBeenLastCalledWith(1);
  });

  it('failed loading can be retried without releasing the current map', async () => {
    const backend = {
      loadBundle: vi.fn().mockResolvedValue(undefined),
      unloadBundle: vi.fn(async () => {}),
    };
    const service = new AssetService(backend);
    await service.prepare('forest', () => {});
    await service.commit('forest');
    backend.loadBundle.mockRejectedValueOnce(new Error('404'));
    await expect(service.prepare('cave', () => {})).rejects.toThrow('404');
    expect(backend.unloadBundle).not.toHaveBeenCalled();
    await service.prepare('cave', () => {});
    await service.commit('cave');
    expect(backend.unloadBundle).toHaveBeenCalledWith('map:forest');
  });
});

describe('session encapsulation', () => {
  it('does not let views or caller-owned objects change live progress', () => {
    const session = new GameSession();
    const input = createGame('測試', 'sword');
    session.start(input);
    input.gold = 999;
    const snapshot = session.state!;
    snapshot.gold = 888;
    snapshot.inventory.herb = 0;
    expect(session.state!.gold).toBe(35);
    expect(session.state!.inventory.herb).toBe(3);
  });

  it('prepares travel without changing the current map and rejects locked portals', () => {
    const session = new GameSession();
    session.start(createGame('測試', 'sword'));
    const portal = MAPS.forest.entities.find((entity) => entity.to === 'temple')!;
    const next = session.prepareTravel(portal);
    expect(next.map).toBe('temple');
    expect(session.state!.map).toBe('forest');
    session.start(next);
    const locked = MAPS.temple.entities.find((entity) => entity.to === 'mountain')!;
    expect(() => session.prepareTravel(locked)).toThrow('禁地');
  });

  it('blocks inventory changes during battle and settles rewards once', () => {
    const session = new GameSession();
    const state = createGame('測試', 'sword');
    state.quest = 'trial';
    session.start(state);
    session.startBattle('trial');
    expect(session.changeItem('buy', 'herb')).toBe(false);
    for (let i = 0; i < 20 && !session.battle!.result; i++) {
      session.act({ type: 'attack', target: 0 });
      session.battle!.update(2.5);
    }
    expect(session.battle!.result).toBe('victory');
    session.finishBattle();
    const gold = session.state!.gold;
    expect(session.finishBattle()).toBe(null);
    expect(session.state!.gold).toBe(gold);
    expect(session.state!.quest).toBe('report');
  });
});

describe('save storage adapter', () => {
  it('falls back to a valid slot when another is corrupted', () => {
    const data = new Map([
      ['legend-story-next:v1:manual', '{broken'],
      ['legend-story-next:v1:auto', encodeSave(createGame('旅人', 'fist'))],
    ]);
    const saves = new SaveRepository({
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        data.set(key, value);
      },
    });
    expect(saves.newestSave()!.state.name).toBe('旅人');
    saves.writeSave(createGame('新旅人', 'sword'), 'manual');
    expect(saves.readSave('manual')!.state.name).toBe('新旅人');
  });

  it('reports blocked storage instead of silently claiming success', () => {
    const saves = new SaveRepository({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(() => saves.newestSave()).toThrow('blocked');
    expect(() => saves.writeSave(createGame('旅人', 'sword'), 'auto')).toThrow('quota');
  });
});
