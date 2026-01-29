import type { SaveAdapter, SaveDataV1 } from "./saveAdapter";

// セーブ/バックアップのキーはUI側でも参照したいのでexportする
export const SAVE_KEY = "DUEL_CHOICE_BATTLE_SAVE_V1";
export const BACKUP_KEY = "DUEL_CHOICE_BATTLE_SAVE_V1_BACKUP";

export const localStorageAdapter: SaveAdapter = {
  async load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveDataV1;
      if (parsed.version !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  async save(data) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  },
  async clear() {
    localStorage.removeItem(SAVE_KEY);
  },
};
