import type { BalanceDef, SkillDef, UnitDef } from "../../engine/types";

export interface BattleDef {
  id: string;
  format: "1v1" | "3v3";
  enemyTeam: Array<{ unitId: string; level: number; skillSet?: string[] }>;
  aiProfileId: string;
  rewards: { trainingPoints: number; unlockSkillIds: string[] };
}

export interface StoryDef {
  startNodeId: string;
  nodes: Array<{
    id: string;
    text: string;
    choices: Array<{ label: string; nextNodeId: string; battleId?: string; reward?: { trainingPoints?: number } }>;
  }>;
}

export interface AiProfileDef {
  id: string;
  lookahead: 0 | 1;
  randomness: number;
  riskAversion: number;
}

export interface GameData {
  balance: BalanceDef;
  units: UnitDef[];
  skills: SkillDef[];
  battles: BattleDef[];
  story: StoryDef;
  ai: AiProfileDef[];
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
}

export async function loadGameData(): Promise<GameData> {
  const [balance, units, skills, battles, story, ai] = await Promise.all([
    getJson<BalanceDef>("/data/balance.json"),
    getJson<UnitDef[]>("/data/units.json"),
    getJson<SkillDef[]>("/data/skills.json"),
    getJson<BattleDef[]>("/data/battles.json"),
    getJson<StoryDef>("/data/story.json"),
    getJson<AiProfileDef[]>("/data/ai.json"),
  ]);
  return { balance, units, skills, battles, story, ai };
}
