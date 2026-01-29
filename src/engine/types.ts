export type BattleFormat = "1v1" | "3v3";
export type StatName = "hp" | "atk" | "def" | "spd";
export type Stage = -2 | -1 | 0 | 1 | 2;
export type Side = "A" | "B";

export type UnitRef = { side: Side; slot: number }; // slot: 0..2

export type Action =
  | { kind: "useSkill"; user: UnitRef; skillId: string }
  | { kind: "swap"; user: UnitRef; toSlot: number }
  | { kind: "none"; user: UnitRef };

export type SkillType = "attack" | "buff" | "debuff" | "guard" | "heal" | "charge";

export interface BalanceDef {
  buffStageMin: number;
  buffStageMax: number;
  stageMultipliers: number[];
  spMax: number;
  damage: { defCoef: number; minDamage: number; randomPct: number };
  spGain: { onAttack: number; onHit: number };
  swap: { allowed: boolean };
}

export interface UnitDef {
  id: string;
  name: string;
  baseStats: Record<StatName, number>;
  growth: Record<StatName, number>;
  learnableSkillIds: string[];
  defaultSkillSet: string[];
}

export interface SkillDef {
  id: string;
  name: string;
  type: SkillType;
  target: "self" | "enemyActive" | "allyActive" | "anyEnemy" | "anyAlly";
  power?: number;
  hit?: number;
  cooldown: number;
  spCost: number;

  guardPct?: number;
  durationTurns?: number;
  healPct?: number;
  buff?: { stat: Exclude<StatName, "hp">; delta: 1 | 2 };
  debuff?: { stat: Exclude<StatName, "hp">; delta: -1 | -2 };
  chargeMul?: number;
}

export interface UnitInstance {
  unitId: string;
  level: number;

  /**
   * 育成（ポイント振り）による恒久ボーナス。
   * バトル中のバフ/デバフ（stages）とは別。
   */
  bonus?: Partial<Record<StatName, number>>;

  maxHp: number;
  hp: number;

  stages: { atk: Stage; def: Stage; spd: Stage };

  sp: number;

  skillSet: [string, string, string, string];
  cooldowns: Record<string, number>;

  guard?: { pct: number; turnsLeft: number };
  charge?: { mul: number; turnsLeft: number };

  alive: boolean;
}

export interface TeamState {
  members: UnitInstance[];
  activeSlot: number;
}

export interface BattleState {
  engineVersion: string;
  format: BattleFormat;
  turn: number;

  seed: number;
  rngCounter: number;

  teams: Record<Side, TeamState>;
  winner?: Side;

  events: BattleEvent[];
}

export type BattleEvent =
  | { kind: "TURN_START"; turn: number }
  | { kind: "ACTION"; actor: UnitRef; action: Action }
  | { kind: "SWAP"; side: Side; from: number; to: number }
  | { kind: "HIT_CHECK"; actor: UnitRef; target: UnitRef; skillId: string; hit: boolean }
  | { kind: "DAMAGE"; actor: UnitRef; target: UnitRef; amount: number; hpAfter: number }
  | { kind: "HEAL"; actor: UnitRef; target: UnitRef; amount: number; hpAfter: number }
  | { kind: "STAGE"; actor: UnitRef; target: UnitRef; stat: "atk" | "def" | "spd"; delta: number; stageAfter: Stage }
  | { kind: "GUARD_SET"; target: UnitRef; pct: number; turns: number }
  | { kind: "CHARGE_SET"; target: UnitRef; mul: number; turns: number }
  | { kind: "COOLDOWN"; target: UnitRef; skillId: string; valueAfter: number }
  | { kind: "SP"; target: UnitRef; delta: number; valueAfter: number }
  | { kind: "KO"; target: UnitRef }
  | { kind: "BATTLE_END"; winner: Side };
