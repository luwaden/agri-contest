/**
 * One row per (application, panel member). It is both the ASSIGNMENT and that person's SCORE SHEET, so every score
 * stays attached to who gave it and when (framework: every score and comment is recorded for audit).
 */
export type PanelRole = "JUDGE" | "REVIEWER";

export type ReviewStatus =
  | "ASSIGNED"      // not opened yet
  | "IN_PROGRESS"   // some scores saved, not submitted
  | "SUBMITTED"     // final; locked unless an administrator reopens it
  | "CONFLICT"      // the panel member declared a conflict of interest: never scored, needs reassigning
  | "WITHDRAWN";    // removed by an administrator before it was submitted

export interface PanelReview {
  reviewId: string;
  applicationId: string;
  panelEmail: string;
  panelName: string;
  panelRole: PanelRole;
  status: ReviewStatus;
  assignedAt: string;
  assignedBy: string;
  /** criterionId → 1..10. Missing = not scored yet (never treated as zero). */
  scores: Record<string, number>;
  /** criterionId → optional note explaining the score. */
  comments: Record<string, string>;
  overallComment: string;
  /** Weighted total out of 100, set only when submitted. */
  total: number | null;
  conflictNote: string;
  updatedAt: string;
  submittedAt: string | null;
  /** Screening round: the reviewer passes this application to the next stage. Each reviewer has a limited number of passes. */
  decision: "PASS" | null;
}

/** Counts towards "this application has enough panel members". Conflicts and withdrawn rows do not. */
export const isLiveReview = (r: PanelReview) => r.status !== "CONFLICT" && r.status !== "WITHDRAWN";
