export type Outcome = "green" | "yellow" | "red";
export const MAX_TRIES = 3;
export const ROUND_SIZES = [15, 30, 50, "all"] as const;
export type RoundSize = (typeof ROUND_SIZES)[number];

export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j] as T, a[i] as T]; }
  return a;
}
export function pickQuestions<T>(items: readonly T[], size: RoundSize, rand?: () => number): T[] {
  const s = shuffle(items, rand);
  return size === "all" ? s : s.slice(0, Math.min(size, s.length));
}
/** Result after a click. `misses` = wrong clicks before this one. null = keep guessing. */
export function judge(correct: boolean, misses: number): Outcome | null {
  if (correct) return misses === 0 ? "green" : "yellow";
  return misses + 1 >= MAX_TRIES ? "red" : null;
}
