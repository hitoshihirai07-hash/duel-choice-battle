import type { BattleFormat, SkillDef, UnitDef } from "./types";

export function assertSkillSet4(skillSet: string[]) {
  if (skillSet.length !== 4) throw new Error("skillSet must be exactly 4 ids");
}

export function assertFormatTeams(format: BattleFormat, teamSizeA: number, teamSizeB: number) {
  if (format === "1v1") {
    if (teamSizeA !== 1 || teamSizeB !== 1) throw new Error("1v1 requires team size 1");
  } else {
    if (teamSizeA !== 3 || teamSizeB !== 3) throw new Error("3v3 requires team size 3");
  }
}

export function mapById<T extends { id: string }>(arr: T[]): Record<string, T> {
  return Object.fromEntries(arr.map((x) => [x.id, x]));
}

export function safeGet<T>(map: Record<string, T>, id: string, label: string): T {
  const v = map[id];
  if (!v) throw new Error(`${label} not found: ${id}`);
  return v;
}
