export type SoundCue = 'ui' | 'hit' | 'hurt' | 'heal' | 'guard' | 'victory' | 'defeat';

const TONES: Record<SoundCue, { notes: number[]; duration: number; wave: OscillatorType }> = {
  ui: { notes: [660], duration: 0.06, wave: 'sine' },
  hit: { notes: [180, 90], duration: 0.06, wave: 'triangle' },
  hurt: { notes: [100, 65], duration: 0.09, wave: 'triangle' },
  heal: { notes: [392, 523, 659], duration: 0.12, wave: 'sine' },
  guard: { notes: [260, 390], duration: 0.07, wave: 'triangle' },
  victory: { notes: [392, 523, 587, 784], duration: 0.18, wave: 'sine' },
  defeat: { notes: [294, 262, 196], duration: 0.2, wave: 'triangle' },
};

export class AudioService {
  private _context: AudioContext | null = null;
  private _voices = new Map<OscillatorNode, GainNode>();
  private _volume = 0.25;
  private _active = true;
  private _disposed = false;

  constructor(private readonly _createContext: () => AudioContext = () => new AudioContext()) {}

  get volume(): number {
    return this._volume;
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      return;
    }
    this._volume = volume;
    this.stopSounds();
  }

  async unlock(): Promise<void> {
    if (this._disposed || !this._active || !this._volume) {
      return;
    }
    try {
      this._context ??= this._createContext();
      if (this._context.state === 'suspended') {
        await this._context.resume();
      }
    } catch {
      // 瀏覽器拒絕音訊時仍可繼續遊戲，下次使用者操作再嘗試。
    }
  }

  setActive(active: boolean): void {
    this._active = active;
    if (!active) {
      this.stopSounds();
      void this._context?.suspend().catch(() => {});
    }
  }

  play(cue: SoundCue): void {
    const context = this._context;
    if (this._disposed || !this._active || !this._volume || context?.state !== 'running') {
      return;
    }
    const tone = TONES[cue];
    if (cue === 'victory' || cue === 'defeat') {
      this.stopSounds();
    }
    // 同一幀多人命中也不無限疊加音量。
    if (this._voices.size + tone.notes.length > 12) {
      return;
    }
    tone.notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * tone.duration;
      oscillator.type = tone.wave;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(this._volume * 0.16, start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      this._voices.set(oscillator, gain);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this._voices.delete(oscillator);
      };
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.01);
    });
  }

  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this.stopSounds();
    void this._context?.close().catch(() => {});
    this._context = null;
  }

  private stopSounds(): void {
    for (const [oscillator, gain] of this._voices) {
      oscillator.onended = null;
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
    }
    this._voices.clear();
  }
}
