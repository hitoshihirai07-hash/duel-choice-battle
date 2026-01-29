import type { SaveAdapter, SaveDataV1 } from "./saveAdapter";

const KEY = "DUEL_CHOICE_BATTLE_SAVE_V1";

export const localStorageAdapter: SaveAdapter = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveDataV1;
      if (parsed.version !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  async save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  },
  async clear() {
    localStorage.removeItem(KEY);
  },
};
