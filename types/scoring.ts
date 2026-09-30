export interface ScoringCriterion {
  id: string;
  name: string;
  description: string;
  maximumScore: number;
  weight: number;
  active: boolean;
}

/** One row per (application, judge, criterion): keeps every judge's score auditable. */
export interface JudgeScore {
  applicationId: string;
  judgeId: string;
  criterionId: string;
  score: number;
  comment?: string;
  submitted: boolean;
  updatedAt: string;
}

/** Average over judges who SUBMITTED. Missing scores are never treated as zero. */
export function averageScore(perJudgeTotals: Array<number | null | undefined>): number | null {
  const valid = perJudgeTotals.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
