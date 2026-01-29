import type { BattleState } from "./types";

export function battleLogToText(state: BattleState): string[] {
  const lines: string[] = [];
  for (const e of state.events) {
    switch (e.kind) {
      case "TURN_START":
        lines.push(`--- Turn ${e.turn} ---`);
        break;
      case "SWAP":
        lines.push(`[${e.side}] swap: ${e.from} -> ${e.to}`);
        break;
      case "HIT_CHECK":
        lines.push(`hit? ${e.skillId} => ${e.hit ? "YES" : "NO"}`);
        break;
      case "DAMAGE":
        lines.push(`DMG ${e.amount} -> (${e.target.side}:${e.target.slot}) HP=${e.hpAfter}`);
        break;
      case "HEAL":
        lines.push(`HEAL ${e.amount} -> (${e.target.side}:${e.target.slot}) HP=${e.hpAfter}`);
        break;
      case "STAGE":
        lines.push(`STAGE ${e.stat} ${e.delta} => ${e.stageAfter} (${e.target.side}:${e.target.slot})`);
        break;
      case "GUARD_SET":
        lines.push(`GUARD ${Math.round(e.pct*100)}% for ${e.turns}t (${e.target.side}:${e.target.slot})`);
        break;
      case "CHARGE_SET":
        lines.push(`CHARGE x${e.mul} for ${e.turns}t (${e.target.side}:${e.target.slot})`);
        break;
      case "BATTLE_END":
        lines.push(`*** WINNER: ${e.winner} ***`);
        break;
      default:
        break;
    }
  }
  return lines;
}
