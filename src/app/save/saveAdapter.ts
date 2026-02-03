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

  /**
   * デイリーチャレンジ
   * - claimed は JST の日付キー（YYYY-MM-DD）で管理
   */
  daily?: {
    claimed: Record<string, { v1?: boolean; v3?: boolean }>; // v1=1v1, v3=3v3
    streak: number;
    lastClearedDate?: string; // YYYY-MM-DD (JST)

    /**
     * 週間報酬（デイリー勝利の累計で解放）
     * - weekKey: その週の月曜（YYYY-MM-DD, JST）
     */
    weekly?: {
      weekKey: string;
      claimed: { w3?: boolean; w5?: boolean; w7?: boolean };
      w5Options?: string[]; // 5勝報酬の「選択肢」固定（週ごと）
    };
  };
}

export interface SaveAdapter {
  load(): Promise<SaveDataV1 | null>;
  save(data: SaveDataV1): Promise<void>;
  clear(): Promise<void>;
}
