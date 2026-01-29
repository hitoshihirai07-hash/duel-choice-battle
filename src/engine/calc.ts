import type { BalanceDef, Stage } from "./types";
import { nextRand } from "./rng";

export function clampStage(stage: number, min: number, max: number): Stage {
  const s = Math.max(min, Math.min(max, stage));
  return s as Stage;
}

export function stageMultiplier(balance: BalanceDef, stage: Stage): number {
  const idx = stage - (balance.buffStageMin as Stage);
  return balance.stageMultipliers[idx] ?? 1.0;
}

export function rollHit(seed: number, counter: number, p: number): boolean {
  const r = nextRand(seed, counter);
  return r <= p;
}

export function rollRange(seed: number, counter: number, pct: number): number {
  if (pct <= 0) return 1.0;
  const r = nextRand(seed, counter);
  const lo = 1.0 - pct;
  const hi = 1.0 + pct;
  return lo + (hi - lo) * r;
}
