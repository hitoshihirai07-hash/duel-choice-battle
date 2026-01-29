export interface SaveDataV1 {
  version: 1;
  updatedAt: number;
  story: { currentNodeId: string; flags: Record<string, boolean> };
  roster: Array<{
    unitId: string;
    level: number;
    trainingPointsSpent: Partial<Record<"hp" | "atk" | "def" | "spd", number>>;
    unlockedSkillIds: string[];
    equippedSkillSet: [string, string, string, string];
  }>;
  resources: { trainingPoints: number };
  settings: { textSpeed: number; sfx: number; bgm: number };
}

export interface SaveAdapter {
  load(): Promise<SaveDataV1 | null>;
  save(data: SaveDataV1): Promise<void>;
  clear(): Promise<void>;
}
