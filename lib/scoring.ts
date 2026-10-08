import { DEFAULT_CRITERIA, SCORE_BANDS, TIE_BREAK_ORDER } from "@/config/scoring";
import type { ScoringCriterion } from "@/types/scoring";

export type RawScores = Record<string, number>;

/** Weighted total out of 100, or null if any active criterion is missing or outside 1..max. Never treats a missing score as zero. */
export function weightedTotal(scores: RawScores, criteria: ScoringCriterion[] = DEFAULT_CRITERIA): number | null {
  let total = 0;
  for (const c of criteria.filter((x) => x.active)) {
    const s = scores[c.id];
    if (!Number.isInteger(s) || s < 1 || s > c.maximumScore) return null;
    total += (s / c.maximumScore) * c.weight;
  }
  return Math.round(total * 100) / 100;
}

export const bandFor = (score: number) => SCORE_BANDS.find((b) => score >= b.min && score <= b.max)?.band ?? null;

export interface Ranked { id: string; total: number; raw: RawScores }

/** Sort comparator: higher total first; ties by originality, then scalability, then feasibility. Remaining ties need the moderation panel. */
export function compareRanked(a: Ranked, b: Ranked): number {
  if (b.total !== a.total) return b.total - a.total;
  for (const k of TIE_BREAK_ORDER) if ((b.raw[k] ?? 0) !== (a.raw[k] ?? 0)) return (b.raw[k] ?? 0) - (a.raw[k] ?? 0);
  return 0;
}
export const needsModeration = (a: Ranked, b: Ranked) => compareRanked(a, b) === 0;
