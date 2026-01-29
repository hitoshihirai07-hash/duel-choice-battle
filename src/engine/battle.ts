import type {
  Action,
  BalanceDef,
  BattleEvent,
  BattleFormat,
  BattleState,
  Side,
  SkillDef,
  TeamState,
  UnitDef,
  UnitInstance,
  UnitRef,
} from "./types";
import { clampStage, rollHit, rollRange, stageMultiplier } from "./calc";
import { assertFormatTeams, mapById, safeGet } from "./validate";

type Defs = {
  balance: BalanceDef;
  units: UnitDef[];
  skills: SkillDef[];
};

export function makeUnitInstance(unit: UnitDef, level: number): UnitInstance {
  const maxHp = unit.baseStats.hp + unit.growth.hp * (level - 1);
  const atk = unit.baseStats.atk + unit.growth.atk * (level - 1);
  const def = unit.baseStats.def + unit.growth.def * (level - 1);
  const spd = unit.baseStats.spd + unit.growth.spd * (level - 1);

  // We store derived base stats via maxHp & stages multipliers in calc
  // atk/def/spd base are re-derived from unit defs + level when needed.
  // For simplicity, keep them in instance? We'll compute on the fly.
  void atk; void def; void spd;

  const skillSet = unit.defaultSkillSet.slice(0, 4) as [string, string, string, string];

  return {
    unitId: unit.id,
    level,
    maxHp,
    hp: maxHp,
    stages: { atk: 0, def: 0, spd: 0 },
    sp: 0,
    skillSet,
    cooldowns: {},
    alive: true,
  };
}

export function initBattle(params: {
  engineVersion: string;
  format: BattleFormat;
  seed: number;
  teamA: TeamState;
  teamB: TeamState;
}): BattleState {
  assertFormatTeams(params.format, params.teamA.members.length, params.teamB.members.length);

  return {
    engineVersion: params.engineVersion,
    format: params.format,
    turn: 1,
    seed: params.seed,
    rngCounter: 0,
    teams: { A: params.teamA, B: params.teamB },
    events: [],
  };
}

export function listLegalActions(state: BattleState, defs: Defs, side: Side): Action[] {
  const team = state.teams[side];
  const active = team.members[team.activeSlot];

  if (!active.alive) return [{ kind: "none", user: { side, slot: team.activeSlot } }];

  const unitMap = mapById(defs.units);
  const unit = safeGet(unitMap, active.unitId, "unit");
  const skillMap = mapById(defs.skills);

  const actions: Action[] = [];

  for (const skillId of active.skillSet) {
    const skill = safeGet(skillMap, skillId, "skill");
    // check learned
    if (!unit.learnableSkillIds.includes(skillId)) continue;

    const cd = active.cooldowns[skillId] ?? 0;
    if (cd > 0) continue;
    if (active.sp < (skill.spCost ?? 0)) continue;
    actions.push({ kind: "useSkill", user: { side, slot: team.activeSlot }, skillId });
  }

  if (state.format === "3v3" && defs.balance.swap.allowed) {
    for (let i = 0; i < team.members.length; i++) {
      if (i === team.activeSlot) continue;
      if (!team.members[i].alive) continue;
      actions.push({ kind: "swap", user: { side, slot: team.activeSlot }, toSlot: i });
    }
  }

  if (actions.length === 0) actions.push({ kind: "none", user: { side, slot: team.activeSlot } });
  return actions;
}

function baseStatAtLevel(unit: UnitDef, level: number, stat: "atk" | "def" | "spd"): number {
  const base = unit.baseStats[stat];
  const g = unit.growth[stat];
  return base + g * (level - 1);
}

function getActiveRef(state: BattleState, side: Side): UnitRef {
  return { side, slot: state.teams[side].activeSlot };
}

function getUnitInstance(state: BattleState, ref: UnitRef): UnitInstance {
  return state.teams[ref.side].members[ref.slot];
}

function otherSide(side: Side): Side {
  return side === "A" ? "B" : "A";
}

function applyEndOfTurnEffects(mut: BattleState): void {
  for (const side of ["A", "B"] as const) {
    const team = mut.teams[side];
    for (const u of team.members) {
      // cooldown tick
      for (const k of Object.keys(u.cooldowns)) {
        if (u.cooldowns[k] > 0) u.cooldowns[k] -= 1;
      }
      if (u.guard) {
        u.guard.turnsLeft -= 1;
        if (u.guard.turnsLeft <= 0) delete u.guard;
      }
      if (u.charge) {
        u.charge.turnsLeft -= 1;
        if (u.charge.turnsLeft <= 0) delete u.charge;
      }
    }
  }
}

function markKOIfNeeded(mut: BattleState, ref: UnitRef): void {
  const u = getUnitInstance(mut, ref);
  if (u.alive && u.hp <= 0) {
    u.hp = 0;
    u.alive = false;
    mut.events.push({ kind: "KO", target: ref });
  }
}

function checkWinner(mut: BattleState): void {
  const aAlive = mut.teams.A.members.some((u) => u.alive);
  const bAlive = mut.teams.B.members.some((u) => u.alive);
  if (!aAlive) mut.winner = "B";
  if (!bAlive) mut.winner = "A";
  if (mut.winner) mut.events.push({ kind: "BATTLE_END", winner: mut.winner });
}

function ensureActiveAlive(mut: BattleState, side: Side): void {
  const team = mut.teams[side];
  const active = team.members[team.activeSlot];
  if (active.alive) return;

  // auto swap to first alive
  const idx = team.members.findIndex((u) => u.alive);
  if (idx >= 0) {
    const from = team.activeSlot;
    team.activeSlot = idx;
    mut.events.push({ kind: "SWAP", side, from, to: idx });
  }
}

function applySwap(mut: BattleState, action: Action): void {
  if (action.kind !== "swap") return;
  const side = action.user.side;
  const team = mut.teams[side];
  const from = team.activeSlot;
  if (mut.format !== "3v3") return;
  if (action.toSlot < 0 || action.toSlot >= team.members.length) return;
  if (!team.members[action.toSlot].alive) return;
  team.activeSlot = action.toSlot;
  mut.events.push({ kind: "SWAP", side, from, to: action.toSlot });
}

function applySkill(mut: BattleState, defs: Defs, actorRef: UnitRef, skillId: string): void {
  const skillMap = mapById(defs.skills);
  const unitMap = mapById(defs.units);
  const balance = defs.balance;

  const actor = getUnitInstance(mut, actorRef);
  if (!actor.alive) return;

  const skill = safeGet(skillMap, skillId, "skill");
  const actorDef = safeGet(unitMap, actor.unitId, "unit");

  // spend SP and set cooldown
  const spCost = skill.spCost ?? 0;
  actor.sp = Math.max(0, actor.sp - spCost);
  if (skill.cooldown > 0) {
    actor.cooldowns[skillId] = skill.cooldown;
    mut.events.push({ kind: "COOLDOWN", target: actorRef, skillId, valueAfter: actor.cooldowns[skillId] });
  }
  if (spCost !== 0) mut.events.push({ kind: "SP", target: actorRef, delta: -spCost, valueAfter: actor.sp });

  const enemyActiveRef = getActiveRef(mut, otherSide(actorRef.side));
  const selfRef = actorRef;

  const targetRef = skill.target === "self" ? selfRef : enemyActiveRef;
  const target = getUnitInstance(mut, targetRef);
  if (!target.alive) return;

  const hitP = skill.hit ?? 1.0;
  let hit = true;
  if (hitP < 1.0) {
    hit = rollHit(mut.seed, mut.rngCounter++, hitP);
    mut.events.push({ kind: "HIT_CHECK", actor: actorRef, target: targetRef, skillId, hit });
    if (!hit) return;
  }

  if (skill.type === "attack") {
    // gain sp on attack
    actor.sp = Math.min(balance.spMax, actor.sp + balance.spGain.onAttack);
    mut.events.push({ kind: "SP", target: actorRef, delta: balance.spGain.onAttack, valueAfter: actor.sp });

    const atkBase = baseStatAtLevel(actorDef, actor.level, "atk");
    const defBase = baseStatAtLevel(safeGet(unitMap, target.unitId, "unit"), target.level, "def");

    const atkMul = stageMultiplier(balance, actor.stages.atk);
    const defMul = stageMultiplier(balance, target.stages.def);

    const power = skill.power ?? 1.0;

    const chargeMul = actor.charge?.mul ?? 1.0;
    if (actor.charge) delete actor.charge; // consumed

    const dmgRaw = (atkBase * atkMul * power * chargeMul) - (defBase * defMul * balance.damage.defCoef);
    let dmg = Math.max(balance.damage.minDamage, Math.floor(dmgRaw));

    // random range
    const rangeMul = rollRange(mut.seed, mut.rngCounter++, balance.damage.randomPct);
    dmg = Math.max(balance.damage.minDamage, Math.floor(dmg * rangeMul));

    // guard reduction
    if (target.guard) {
      dmg = Math.max(balance.damage.minDamage, Math.floor(dmg * (1 - target.guard.pct)));
    }

    target.hp = Math.max(0, target.hp - dmg);
    mut.events.push({ kind: "DAMAGE", actor: actorRef, target: targetRef, amount: dmg, hpAfter: target.hp });

    // sp gain on hit (victim)
    target.sp = Math.min(balance.spMax, target.sp + balance.spGain.onHit);
    mut.events.push({ kind: "SP", target: targetRef, delta: balance.spGain.onHit, valueAfter: target.sp });

    markKOIfNeeded(mut, targetRef);
    ensureActiveAlive(mut, targetRef.side);
    checkWinner(mut);
    return;
  }

  if (skill.type === "guard") {
    const pct = skill.guardPct ?? 0.5;
    const turns = skill.durationTurns ?? 1;
    actor.guard = { pct, turnsLeft: turns };
    mut.events.push({ kind: "GUARD_SET", target: actorRef, pct, turns });
    return;
  }

  if (skill.type === "charge") {
    const mul = skill.chargeMul ?? 1.4;
    const turns = skill.durationTurns ?? 1;
    actor.charge = { mul, turnsLeft: turns };
    mut.events.push({ kind: "CHARGE_SET", target: actorRef, mul, turns });
    return;
  }

  if (skill.type === "heal") {
    const healPct = skill.healPct ?? 0.25;
    const amt = Math.max(1, Math.floor(actor.maxHp * healPct));
    actor.hp = Math.min(actor.maxHp, actor.hp + amt);
    mut.events.push({ kind: "HEAL", actor: actorRef, target: actorRef, amount: amt, hpAfter: actor.hp });
    return;
  }

  if (skill.type === "buff" && skill.buff) {
    const stat = skill.buff.stat;
    const delta = skill.buff.delta;
    const before = actor.stages[stat];
    actor.stages[stat] = clampStage(before + delta, balance.buffStageMin, balance.buffStageMax);
    mut.events.push({ kind: "STAGE", actor: actorRef, target: actorRef, stat, delta, stageAfter: actor.stages[stat] });
    return;
  }

  if (skill.type === "debuff" && skill.debuff) {
    const stat = skill.debuff.stat;
    const delta = skill.debuff.delta;
    const before = target.stages[stat];
    target.stages[stat] = clampStage(before + delta, balance.buffStageMin, balance.buffStageMax);
    mut.events.push({ kind: "STAGE", actor: actorRef, target: targetRef, stat, delta, stageAfter: target.stages[stat] });
    return;
  }
}

function getSpeed(mut: BattleState, defs: Defs, ref: UnitRef): number {
  const u = getUnitInstance(mut, ref);
  if (!u.alive) return -1;

  const unitMap = mapById(defs.units);
  const unitDef = safeGet(unitMap, u.unitId, "unit");
  const base = baseStatAtLevel(unitDef, u.level, "spd");
  const mul = stageMultiplier(defs.balance, u.stages.spd);
  return base * mul;
}

export function resolveTurn(state: BattleState, defs: Defs, actionA: Action, actionB: Action): BattleState {
  // immutable-ish: deep clone minimal
  const mut: BattleState = structuredClone(state);

  if (mut.winner) return mut;

  mut.events.push({ kind: "TURN_START", turn: mut.turn });
  mut.events.push({ kind: "ACTION", actor: actionA.user, action: actionA });
  mut.events.push({ kind: "ACTION", actor: actionB.user, action: actionB });

  // If swap: process swaps first? We'll treat swap as normal action but resolved in order.
  const aRef = getActiveRef(mut, "A");
  const bRef = getActiveRef(mut, "B");

  const aSpd = getSpeed(mut, defs, aRef);
  const bSpd = getSpeed(mut, defs, bRef);

  let first: Side = "A";
  if (bSpd > aSpd) first = "B";
  else if (aSpd === bSpd) {
    // deterministic tie-break
    const r = rollHit(mut.seed, mut.rngCounter++, 0.5);
    first = r ? "A" : "B";
  }

  const order: Array<{ side: Side; action: Action }> =
    first === "A"
      ? [{ side: "A", action: actionA }, { side: "B", action: actionB }]
      : [{ side: "B", action: actionB }, { side: "A", action: actionA }];

  for (const step of order) {
    if (mut.winner) break;

    // ensure actives are alive
    ensureActiveAlive(mut, step.side);
    ensureActiveAlive(mut, otherSide(step.side));

    const team = mut.teams[step.side];
    const actorRef: UnitRef = { side: step.side, slot: team.activeSlot };
    const actor = getUnitInstance(mut, actorRef);
    if (!actor.alive) continue;

    const act = step.action;

    // normalize user slot to current active (UI might pass stale slot)
    if (act.kind === "swap") {
      applySwap(mut, { ...act, user: actorRef });
    } else if (act.kind === "useSkill") {
      applySkill(mut, defs, actorRef, act.skillId);
    } else {
      // none
    }
  }

  applyEndOfTurnEffects(mut);
  ensureActiveAlive(mut, "A");
  ensureActiveAlive(mut, "B");
  checkWinner(mut);

  mut.turn += 1;
  return mut;
}
