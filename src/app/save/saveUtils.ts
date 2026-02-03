import type { GameData } from "../store/dataLoader";
import type { SaveDataV1 } from "./saveAdapter";
import { getJstDateKey, getJstWeekStartKey } from "../daily/daily";

export const TRAINING_STEP = {
  hp: 5,
  atk: 1,
  def: 1,
  spd: 1,
} as const;

function uniqueStrings(xs: string[]) {
  return Array.from(new Set(xs.filter((x) => typeof x === "string" && x.length > 0)));
}

/**
 * 新規開始時の「習得済みスキル」
 * - デフォルト4枠だけを習得済みにする（= 成長で解放する余地を作る）
 * - learnableSkillIds の範囲に収める
 */
function initialUnlockedSkillIds(u: { learnableSkillIds: string[]; defaultSkillSet: string[] }) {
  const learnable = new Set(Array.isArray(u.learnableSkillIds) ? u.learnableSkillIds : []);
  const base = uniqueStrings([...(Array.isArray(u.defaultSkillSet) ? u.defaultSkillSet : []), "sk_attack", "sk_guard"]);
  return base.filter((id) => learnable.has(id));
}

export function createDefaultSave(data: GameData): SaveDataV1 {
  const now = Date.now();
  const todayKey = getJstDateKey(now);
  const weekKey = getJstWeekStartKey(todayKey);

  return {
    version: 1,
    updatedAt: now,
    story: { currentNodeId: data.story.startNodeId, flags: {} },
    roster: data.units.map((u) => ({
      unitId: u.id,
      level: 1,
      trainingPointsSpent: { hp: 0, atk: 0, def: 0, spd: 0 },
      // 最初から全部解放すると成長の意味が薄いので、初期は「デフォルト4枠のみ習得」
      unlockedSkillIds: initialUnlockedSkillIds(u),
      equippedSkillSet: normalizeSkillSet(u.defaultSkillSet),
    })),
    resources: { trainingPoints: 0 },
    settings: { textSpeed: 1, sfx: 1, bgm: 1 },
    daily: {
      claimed: {},
      streak: 0,
      lastClearedDate: undefined,
      weekly: { weekKey, claimed: {}, w5Options: undefined },
    },
  };
}

export function normalizeSave(data: GameData, loaded: SaveDataV1): SaveDataV1 {
  // 拡張に強いように「新ユニットが増えたら追加」「スキルセット長を補完」だけ行う
  const rosterById = new Map(loaded.roster.map((r) => [r.unitId, r] as const));
  const nextRoster = data.units.map((u) => {
    const r = rosterById.get(u.id);
    if (!r) {
      return {
        unitId: u.id,
        level: 1,
        trainingPointsSpent: { hp: 0, atk: 0, def: 0, spd: 0 },
        // 新ユニット追加時も、最初はデフォルト枠のみ習得に揃える
        unlockedSkillIds: initialUnlockedSkillIds(u),
        equippedSkillSet: normalizeSkillSet(u.defaultSkillSet),
      };
    }

    return {
      ...r,
      trainingPointsSpent: {
        hp: r.trainingPointsSpent?.hp ?? 0,
        atk: r.trainingPointsSpent?.atk ?? 0,
        def: r.trainingPointsSpent?.def ?? 0,
        spd: r.trainingPointsSpent?.spd ?? 0,
      },
      unlockedSkillIds: Array.isArray(r.unlockedSkillIds) ? r.unlockedSkillIds : [],
      equippedSkillSet: normalizeSkillSet(r.equippedSkillSet),
    };
  });

  const todayKey = getJstDateKey();
  const curWeekKey = getJstWeekStartKey(todayKey);

  const inWeekly = loaded.daily?.weekly;
  const weekly =
    inWeekly && typeof inWeekly.weekKey === "string"
      ? {
          weekKey: inWeekly.weekKey,
          claimed: inWeekly.claimed ?? {},
          w5Options: Array.isArray(inWeekly.w5Options) ? inWeekly.w5Options : undefined,
        }
      : { weekKey: curWeekKey, claimed: {}, w5Options: undefined };

  // 週が変わっていたら、週間報酬はリセット（デイリーの claimed は残す）
  const normalizedWeekly = weekly.weekKey === curWeekKey ? weekly : { weekKey: curWeekKey, claimed: {}, w5Options: undefined };

  return {
    ...loaded,
    version: 1,
    story: {
      currentNodeId: loaded.story?.currentNodeId ?? data.story.startNodeId,
      flags: loaded.story?.flags ?? {},
    },
    roster: nextRoster,
    resources: { trainingPoints: loaded.resources?.trainingPoints ?? 0 },
    settings: {
      textSpeed: loaded.settings?.textSpeed ?? 1,
      sfx: loaded.settings?.sfx ?? 1,
      bgm: loaded.settings?.bgm ?? 1,
    },
    daily: {
      claimed: loaded.daily?.claimed ?? {},
      streak: loaded.daily?.streak ?? 0,
      lastClearedDate: loaded.daily?.lastClearedDate,
      weekly: normalizedWeekly,
    },
  };
}

export function normalizeSkillSet(src: any): [string, string, string, string] {
  const arr = Array.isArray(src) ? src.filter((x) => typeof x === "string") : [];
  const padded = [...arr];
  while (padded.length < 4) padded.push(arr[0] ?? "sk_attack");
  return padded.slice(0, 4) as [string, string, string, string];
}

export function trainingSpentToBonus(spent?: Partial<Record<"hp" | "atk" | "def" | "spd", number>>) {
  const s = spent ?? {};
  const hp = (s.hp ?? 0) * TRAINING_STEP.hp;
  const atk = (s.atk ?? 0) * TRAINING_STEP.atk;
  const def = (s.def ?? 0) * TRAINING_STEP.def;
  const spd = (s.spd ?? 0) * TRAINING_STEP.spd;
  return { hp, atk, def, spd };
}
