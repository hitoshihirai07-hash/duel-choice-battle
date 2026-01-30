import type { GameData } from "../store/dataLoader";
import type { BattleFormat } from "../../engine/types";

/**
 * JST の日付キー（YYYY-MM-DD）
 * - 端末のタイムゾーンに依存しないよう UTC→JST 変換で算出
 */
export function getJstDateKey(ts = Date.now()): string {
  const local = new Date(ts);
  const utcMs = ts + local.getTimezoneOffset() * 60_000;
  const jst = new Date(utcMs + 9 * 60 * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jst.getFullYear()}-${pad(jst.getMonth() + 1)}-${pad(jst.getDate())}`;
}

export function isDailyBattleId(battleId: string): boolean {
  return battleId === "b_daily_1v1" || battleId === "b_daily_3v3";
}

export function dailyBattleId(format: BattleFormat): string {
  return format === "1v1" ? "b_daily_1v1" : "b_daily_3v3";
}

export function dailyRewardPoints(format: BattleFormat): number {
  return format === "1v1" ? 2 : 4;
}

type Rng = { next: () => number; nextInt: (n: number) => number };

function hash32(str: string): number {
  // FNV-1a (32bit)
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeRng(seed: number): Rng {
  let x = (seed >>> 0) || 0x12345678;
  const next = () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0xffffffff;
  };
  const nextInt = (n: number) => Math.floor(next() * n);
  return { next, nextInt };
}

function pickUnique<T>(arr: T[], k: number, rng: Rng): T[] {
  const pool = arr.slice();
  const out: T[] = [];
  while (pool.length && out.length < k) {
    const i = rng.nextInt(pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function makeDailyEnemyTeam(params: {
  data: GameData;
  format: BattleFormat;
  dateKey: string;
}): Array<{ unitId: string; level: number }> {
  const { data, format, dateKey } = params;
  const seed = hash32(`${dateKey}:${format}`);
  const rng = makeRng(seed);

  const teamSize = format === "1v1" ? 1 : 3;
  const unitIds = data.units.map((u) => u.id);
  const picks = pickUnique(unitIds, teamSize, rng);

  // 難易度は軽め：Lv 1..3（日時・乱数でゆらぎ）
  const base = format === "1v1" ? 1 : 2;
  return picks.map((unitId, idx) => {
    const lv = Math.min(3, Math.max(1, base + ((seed + idx * 31) % 2) + (rng.nextInt(3) === 0 ? 1 : 0)));
    return { unitId, level: lv };
  });
}

/**
 * Battle.tsx が使う「今日のデイリー相手」まとめ。
 * - enemyTeam: BattleDef と同じ形（skillSet は任意）
 * - bg: 背景SVGのパス
 */
export function getDailyEnemyTeam(
  data: GameData,
  format: BattleFormat,
  dateKey: string
): { enemyTeam: Array<{ unitId: string; level: number; skillSet?: string[] }>; bg: string } {
  const base = makeDailyEnemyTeam({ data, format, dateKey });
  const enemyTeam = base.map((x) => ({ unitId: x.unitId, level: x.level }));
  const bg = format === "1v1" ? "/assets/bg/dojo.svg" : "/assets/bg/arena.svg";
  return { enemyTeam, bg };
}

export function dailyBg(format: BattleFormat): string {
  return format === "1v1" ? "dojo" : "arena";
}

export function isYesterdayJst(prev: string, today: string): boolean {
  // prev/today: YYYY-MM-DD
  const toUtcMs = (key: string) => {
    const [y, m, d] = key.split("-").map((x) => Number(x));
    // JST 0:00 を UTC に直す（-9h）
    return Date.UTC(y, (m ?? 1) - 1, d ?? 1, -9, 0, 0, 0);
  };
  const p = toUtcMs(prev);
  const t = toUtcMs(today);
  const dayMs = 24 * 60 * 60 * 1000;
  return t - p === dayMs;
}
