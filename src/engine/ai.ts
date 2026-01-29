import type { Action, BattleState, Side } from "./types";
import type { BalanceDef, SkillDef, UnitDef } from "./types";
import { listLegalActions, resolveTurn } from "./battle";
import { mapById, safeGet } from "./validate";

export interface AiProfile {
  id: string;
  lookahead: 0 | 1;
  randomness: number; // 0..1 (higher = moreブレ)
  riskAversion: number; // 0..1 (higher = safer)
}

type Defs = { balance: BalanceDef; units: UnitDef[]; skills: SkillDef[] };

function other(side: Side): Side {
  return side === "A" ? "B" : "A";
}

function hpRatio(state: BattleState, side: Side): number {
  const t = state.teams[side];
  const sumHp = t.members.reduce((a, u) => a + u.hp, 0);
  const sumMax = t.members.reduce((a, u) => a + u.maxHp, 0);
  return sumMax <= 0 ? 0 : sumHp / sumMax;
}

function stageSum(state: BattleState, side: Side): number {
  const active = state.teams[side].members[state.teams[side].activeSlot];
  return active.stages.atk + active.stages.def + active.stages.spd;
}

function scoreState(state: BattleState, side: Side): number {
  // higher is better for 'side'
  const me = hpRatio(state, side);
  const en = hpRatio(state, other(side));
  const stage = stageSum(state, side) - stageSum(state, other(side));
  const win = state.winner ? (state.winner === side ? 1 : -1) : 0;
  return (me - en) * 100 + stage * 6 + win * 10000;
}

export function chooseAiAction(params: {
  state: BattleState;
  defs: Defs;
  side: Side;
  profile: AiProfile;
}): Action {
  const { state, defs, side, profile } = params;

  const candidates = listLegalActions(state, defs, side);

  // If we are in danger, slightly bias to guard/heal/def buffs by scoring will naturally do so.
  // Evaluate each candidate by simulating vs opponent best response (lookahead 1), else vs noop.
  let best = candidates[0];
  let bestScore = -Infinity;

  const oppSide = other(side);
  const oppCandidates = listLegalActions(state, defs, oppSide);

  for (const a of candidates) {
    let s: number;

    if (profile.lookahead === 1) {
      // opponent chooses best response against this action
      let worstForMe = Infinity;
      for (const b of oppCandidates) {
        const next = side === "A" ? resolveTurn(state, defs, a, b) : resolveTurn(state, defs, b, a);
        const val = scoreState(next, side);
        if (val < worstForMe) worstForMe = val;
      }
      s = worstForMe;
    } else {
      const noop: Action = { kind: "none", user: { side: oppSide, slot: state.teams[oppSide].activeSlot } };
      const next = side === "A" ? resolveTurn(state, defs, a, noop) : resolveTurn(state, defs, noop, a);
      s = scoreState(next, side);
    }

    // risk adjustment: prefer higher minimum HP when riskAversion is high
    const nextA = side === "A" ? resolveTurn(state, defs, a, oppCandidates[0]) : resolveTurn(state, defs, oppCandidates[0], a);
    const meHp = hpRatio(nextA, side);
    s += profile.riskAversion * (meHp * 10);

    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }

  // randomness: sometimes pick a near-best move
  const sorted = candidates
    .map((a) => {
      const noop: Action = { kind: "none", user: { side: oppSide, slot: state.teams[oppSide].activeSlot } };
      const next = side === "A" ? resolveTurn(state, defs, a, noop) : resolveTurn(state, defs, noop, a);
      return { a, s: scoreState(next, side) };
    })
    .sort((x, y) => y.s - x.s);

  if (sorted.length >= 2 && Math.random() < profile.randomness) {
    const pick = sorted[Math.min(sorted.length - 1, 1 + Math.floor(Math.random() * 2))]; // 2〜3位を選びがち
    return pick.a;
  }

  return best;
}
