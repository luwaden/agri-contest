import type { Level2Form } from "@/lib/validation/level2";

/** A submitted Level 2 application. Every answer is kept as text exactly as stored in the sheet. */
export type Level2Application = { [K in Exclude<keyof Level2Form, "declaration">]: string } & {
  level1Code: string;
  submittedAt: string;
  /** The Level 1 email address the person proved they own when starting. */
  level1Email: string;
};
export interface Level2Invite { level1Code: string; invitedAt: string; invitedBy: string; note: string }
