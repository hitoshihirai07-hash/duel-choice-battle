import type { SaveAdapter, SaveDataV1 } from "./saveAdapter";

/**
 * セーブスロット対応
 * - slot 1..3 をサポート
 * - 旧キー(SAVE_KEY/BACKUP_KEY)は slot1 に自動移行
 */

// 旧（単一スロット）キー
export const LEGACY_SAVE_KEY = "DUEL_CHOICE_BATTLE_SAVE_V1";
export const LEGACY_BACKUP_KEY = "DUEL_CHOICE_BATTLE_SAVE_V1_BACKUP";

// 現在選択中スロットを覚えるキー（UI用）
export const ACTIVE_SLOT_KEY = "DUEL_CHOICE_BATTLE_ACTIVE_SLOT";

// スロット数
export const SLOT_COUNT = 3;

export function clampSlot(slot: number): 1 | 2 | 3 {
  const n = Number(slot);
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

export function getSaveKey(slot: number) {
  const s = clampSlot(slot);
  return `DUEL_CHOICE_BATTLE_SAVE_V1_SLOT_${s}`;
}

export function getBackupKey(slot: number) {
  const s = clampSlot(slot);
  return `DUEL_CHOICE_BATTLE_SAVE_V1_SLOT_${s}_BACKUP`;
}

function migrateLegacyToSlot1IfNeeded() {
  try {
    const slot1Key = getSaveKey(1);
    const slot1Has = localStorage.getItem(slot1Key) != null;

    // 旧キーがあり、slot1が空なら移行
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacy && !slot1Has) {
      localStorage.setItem(slot1Key, legacy);
    }

    // 旧バックアップも同様
    const slot1BackupKey = getBackupKey(1);
    const slot1BackupHas = localStorage.getItem(slot1BackupKey) != null;
    const legacyBackup = localStorage.getItem(LEGACY_BACKUP_KEY);
    if (legacyBackup && !slot1BackupHas) {
      localStorage.setItem(slot1BackupKey, legacyBackup);
    }

    // 旧キーは残しても困らないが、混乱防止で消す
    if (legacy) localStorage.removeItem(LEGACY_SAVE_KEY);
    if (legacyBackup) localStorage.removeItem(LEGACY_BACKUP_KEY);
  } catch {
    // ignore
  }
}

export function createLocalStorageAdapter(slot: number): SaveAdapter {
  const s = clampSlot(slot);
  const SAVE_KEY = getSaveKey(s);
  const BACKUP_KEY = getBackupKey(s);

  return {
    async load() {
      try {
        // 初回のみ旧データ移行（slot1）
        if (s === 1) migrateLegacyToSlot1IfNeeded();

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
      // 同じスロットのバックアップも消す
      localStorage.removeItem(BACKUP_KEY);
    },
  };
}
