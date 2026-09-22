import type { SaveStorage } from './SaveRepository';

const AUDIO_KEY = 'legend-story-next:audio-volume';

export class SettingsRepository {
  constructor(private readonly _storage: SaveStorage) {}

  readVolume(): number {
    try {
      const raw = this._storage.getItem(AUDIO_KEY);
      const volume = raw === null || raw.trim() === '' ? NaN : Number(raw);
      return Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : 0.25;
    } catch {
      return 0.25;
    }
  }

  writeVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new Error('音量必須介於 0 與 1。');
    }
    this._storage.setItem(AUDIO_KEY, String(volume));
  }
}
