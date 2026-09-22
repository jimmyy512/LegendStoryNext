import { decodeSave, encodeSave, type SaveRecord, type SaveSlot } from '../game/save';
import type { GameState } from '../game/types';

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const prefix = 'legend-story-next:v1:';

export class SaveRepository {
  constructor(private readonly storage: SaveStorage) {}
  writeSave(state: GameState, slot: SaveSlot): void {
    this.storage.setItem(prefix + slot, encodeSave(state));
  }

  readSave(slot: SaveSlot): SaveRecord | null {
    const raw = this.storage.getItem(prefix + slot);
    return raw ? decodeSave(raw) : null;
  }

  newestSave(): SaveRecord | null {
    const records: SaveRecord[] = [];
    let error: unknown;
    for (const slot of ['manual', 'auto'] as const) {
      try {
        const record = this.readSave(slot);
        if (record) {
          records.push(record);
        }
      } catch (caught) {
        error = caught;
      }
    }
    records.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
    if (records.length) {
      return records[0];
    }
    if (error) {
      throw error;
    }
    return null;
  }
}
