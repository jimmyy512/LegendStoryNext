import { describe, expect, it, vi } from 'vitest';
import { AudioService } from '../src/services/AudioService';
import { SettingsRepository } from '../src/services/SettingsRepository';

function fixture() {
  const parameter = () => ({
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const voices: { stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running';
    }),
    suspend: vi.fn(async () => {
      context.state = 'suspended';
    }),
    close: vi.fn(async () => {
      context.state = 'closed';
    }),
    createOscillator: vi.fn(() => {
      const voice = {
        frequency: parameter(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      voices.push(voice);
      return voice;
    }),
    createGain: vi.fn(() => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() })),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  return { audio: new AudioService(factory), context, factory, voices };
}

describe('音訊生命週期', () => {
  it('使用者解鎖前不建立 context 或播放，解鎖後才播放', async () => {
    const { audio, context, factory } = fixture();
    audio.play('hit');
    expect(factory).not.toHaveBeenCalled();
    await audio.unlock();
    audio.play('hit');
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('靜音立即清除已排程聲音，背景不補播，回前景需重新解鎖', async () => {
    const { audio, context, voices } = fixture();
    await audio.unlock();
    audio.play('victory');
    audio.setVolume(0);
    expect(voices.every((voice) => voice.disconnect.mock.calls.length === 1)).toBe(true);
    audio.play('hit');
    expect(context.createOscillator).toHaveBeenCalledTimes(4);
    audio.setVolume(0.5);
    audio.setActive(false);
    await audio.unlock();
    audio.play('hit');
    expect(context.resume).toHaveBeenCalledTimes(1);
    audio.setActive(true);
    audio.play('hit');
    expect(context.createOscillator).toHaveBeenCalledTimes(4);
    await audio.unlock();
    audio.play('ui');
    expect(context.createOscillator).toHaveBeenCalledTimes(5);
  });

  it('限制同時播放數量，勝敗音可取代舊聲音', async () => {
    const { audio, context } = fixture();
    await audio.unlock();
    for (let i = 0; i < 30; i++) {
      audio.play('hit');
    }
    expect(context.createOscillator).toHaveBeenCalledTimes(12);
    audio.play('victory');
    expect(context.createOscillator).toHaveBeenCalledTimes(16);
  });

  it('重複釋放只關閉一次，解鎖失敗不拋出至遊戲', async () => {
    const { audio, context, factory } = fixture();
    context.resume.mockRejectedValueOnce(new Error('not allowed'));
    await expect(audio.unlock()).resolves.toBeUndefined();
    await audio.unlock();
    audio.play('ui');
    audio.dispose();
    audio.dispose();
    await audio.unlock();
    audio.play('hit');
    expect(context.close).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledOnce();
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
  });
});

describe('音量設定', () => {
  it('保存靜音與音量，不影響角色存檔', () => {
    const data = new Map<string, string>();
    const repository = new SettingsRepository({
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        data.set(key, value);
      },
    });
    expect(repository.readVolume()).toBe(0.25);
    repository.writeVolume(0);
    expect(repository.readVolume()).toBe(0);
    repository.writeVolume(0.5);
    expect(repository.readVolume()).toBe(0.5);
    expect([...data.keys()]).toEqual(['legend-story-next:audio-volume']);
    expect(() => repository.writeVolume(NaN)).toThrow();
  });

  it.each(['', 'bad', '-1', '2', 'Infinity'])('無效設定 %s 使用預設值', (raw) => {
    const repository = new SettingsRepository({ getItem: () => raw, setItem: vi.fn() });
    expect(repository.readVolume()).toBe(0.25);
  });

  it('停用儲存仍能讀取預設值，寫入失敗交由介面提示', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    const repository = new SettingsRepository({ getItem: blocked, setItem: blocked });
    expect(repository.readVolume()).toBe(0.25);
    expect(() => repository.writeVolume(0)).toThrow('blocked');
  });
});
