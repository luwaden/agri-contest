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
  /** question id → 1..5. Missing = not answered yet. */
  scores: Record<string, number>;
  /** Out of 25, set when submitted. */
  total: number | null;
  decision: "RECOMMEND" | "NOT_RECOMMEND" | null;
  comment: string;
  updatedAt: string;
  submittedAt: string | null;
}
/** Withdrawn rows are kept for the record but no longer count. */
export const isLiveL2Review = (r: Level2Review) => r.status !== "WITHDRAWN";
