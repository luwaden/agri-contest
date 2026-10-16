/**
 * SCREENING PIPELINE SETTINGS (admin only, never shown to applicants).
 *
 *   all submitted ──eligibility rules──▶ ranked by the automatic pre-score ──▶ top SHORTLIST (CSV)
 *   shortlist ──fair spread──▶ REVIEW BATCH shared evenly between reviewers
 *   each reviewer passes up to PASS_PER_REVIEWER ──▶ judges score them ──▶ top FINALISTS
 *
 * The sizes are defaults the admin can change on the Screening page for each run.
 * The age range and nationality come from the programme rules (config/programme.ts). The "complete answers" minimum
 * and the spread floors are working settings chosen by the programme team, not published rules.
 */
export const SCREENING = {
  shortlistSize: 1300,
  batchSize: 500,
  reviewersExpected: 10,
  passPerReviewer: Number(process.env.SCREENING_PASS_PER_REVIEWER) || 15,
  finalists: 30,
  /** Each of these answers needs at least this many words, or the application is not complete enough to judge. */
  minWords: { description: 10, problem: 10, solution: 10 },
  /** The review batch keeps at least this share of each zone / value chain that the shortlist has (0.5 = half its share). */
  spreadFloor: 0.5,
  /** Internal concept-note targets (config/admin.ts TARGETS) are used as minimum shares in the batch when the shortlist has enough people. */
  useInclusionTargets: true,
} as const;
