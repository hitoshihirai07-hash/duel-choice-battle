import type { GameData } from "../store/dataLoader";
import type { SaveDataV1 } from "./saveAdapter";

export const TRAINING_STEP = {
  hp: 5,
  atk: 1,
  def: 1,
  spd: 1,
} as const;

export function createDefaultSave(data: GameData): SaveDataV1 {
  const now = Date.now();

  return {
    version: 1,
    updatedAt: now,
    story: { currentNodeId: data.story.startNodeId, flags: {} },
    roster: data.units.map((u) => ({
      unitId: u.id,
      level: 1,
      trainingPointsSpent: { hp: 0, atk: 0, def: 0, spd: 0 },
      unlockedSkillIds: [...u.learnableSkillIds],
      equippedSkillSet: normalizeSkillSet(u.defaultSkillSet),
    })),
    resources: { trainingPoints: 0 },
    settings: { textSpeed: 1, sfx: 1, bgm: 1 },
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
        unlockedSkillIds: [...u.learnableSkillIds],
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
