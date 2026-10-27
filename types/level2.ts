import type { Level2Form } from "@/lib/validation/level2";

/** A submitted Level 2 application. Every answer is kept as text exactly as stored in the sheet. */
export type Level2Application = { [K in Exclude<keyof Level2Form, "declaration">]: string } & {
  level1Code: string;
  submittedAt: string;
  /** The Level 1 email address the person proved they own when starting. */
  level1Email: string;
};
export interface Level2Invite { level1Code: string; invitedAt: string; invitedBy: string; note: string }

/** Level 2 review: one row per (Level 1 code, reviewer). Assignment and score sheet in one, like Panel Reviews. */
export type Level2ReviewStatus = "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "WITHDRAWN";
export interface Level2Review {
  reviewId: string;
  level1Code: string;
  reviewerEmail: string;
  reviewerName: string;
  status: Level2ReviewStatus;
  assignedAt: string;
  assignedBy: string;
  /** criterion id (config/level2Review.ts) → 0..max. Missing = not marked yet. */
  scores: Record<string, number>;
  /** Marks out of L2_MAX_MARKS, set once every criterion is marked. */
  total: number | null;
  /** total as a whole-number percentage. */
  percent: number | null;
  decision: "RECOMMEND" | "NOT_RECOMMEND" | null;
  comment: string;
  updatedAt: string;
  submittedAt: string | null;
  /** 1, 2 or 3 when the reviewer picked this applicant as one of their top 3. */
  topRank: number | null;
  /** The reviewer's reason for the top-3 pick. */
  topReason: string;
  /** Scores from the first (5-question, out of 25) form, kept as they were. null when the row never used it. */
  legacy: { scores: Record<string, number>; total: number | null } | null;
}
/** Withdrawn rows are kept for the record but no longer count. */
export const isLiveL2Review = (r: Level2Review) => r.status !== "WITHDRAWN";
/** Submitted on the first form and not marked again since: shown as "earlier form", reopen to mark with the current sheet. */
export const isLegacyL2Review = (r: Level2Review) => r.status === "SUBMITTED" && r.total === null && r.legacy?.total != null;
