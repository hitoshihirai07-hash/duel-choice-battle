/**
 * Deterministic RNG (mulberry32-like) with explicit counter.
 * Use `rand(state)` to keep replay compatibility.
 */
export function nextRand(seed: number, counter: number): number {
  let t = (seed + counter * 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
