import type { Level2Application, Level2Invite, Level2Review } from "@/types/level2";
/** One row of the "Configuration" tab. */
export interface ConfigRow { key: string; value: string; updatedAt: string; updatedBy: string }
import type { EmailCampaign, EmailLogRow } from "@/types/email";
import type { Application, ApplicationStatus } from "@/types/application";
import type { MentorApplication, MentorStatus } from "@/types/mentor";
import type { StaffAccount } from "@/types/staff";
import type { PanelReview } from "@/types/review";

export interface StoreDiagnosis {
  ok: boolean; kind: string;
  tabs: Record<string, "ok" | "missing" | "error">;
  headerOk: boolean | null;
  headerProblems?: string[];
  /** Every checked tab: null = header row correct, otherwise a plain-English problem. */
  headerIssues?: Record<string, string | null>;
  code?: string;       // non-sensitive classification of the first failure
}
export interface AuditEvent {
  at: string; applicationId: string; actor: string; action: string; detail: string;
}
export interface DraftRecord {
  tokenHash: string; email: string; updatedAt: string; values: Record<string, unknown>; stage: number;
}

/**
 * The ONLY contract the rest of the app depends on. Google Sheets today; PostgreSQL/Supabase later
 * means writing one more class that implements this interface. No UI or route imports a backend directly.
 */
export interface ApplicationRepository {
  readonly kind: "sheets" | "local";
  createApplication(app: Application): Promise<void>;
  getApplications(): Promise<Application[]>;
  getApplicationById(id: string): Promise<Application | null>;
  updateApplication(app: Application): Promise<void>;
  updateStatus(id: string, status: ApplicationStatus, actor: string): Promise<Application | null>;
  saveDraft(draft: DraftRecord): Promise<void>;
  getDraft(tokenHash: string): Promise<DraftRecord | null>;
  deleteDraft(tokenHash: string): Promise<void>;
  countDrafts(): Promise<number>;
  // Mentors live in their own table/sheet, never mixed with applicant records
  createMentor(m: MentorApplication): Promise<void>;
  getMentors(): Promise<MentorApplication[]>;
  getMentorById(id: string): Promise<MentorApplication | null>;
  updateMentorStatus(id: string, status: MentorStatus, actor: string): Promise<MentorApplication | null>;
  getEvents(limit?: number): Promise<AuditEvent[]>;
  // Staff sign-in accounts kept in the store ("Admin Users" tab). Env accounts are handled in lib/auth/users.ts.
  getStaff(): Promise<StaffAccount[]>;
  /** Throws DUPLICATE_EMAIL if the email already exists. */
  createStaff(a: StaffAccount): Promise<void>;
  updateStaff(email: string, patch: Partial<Pick<StaffAccount, "name" | "role" | "active" | "note" | "passwordHash">>): Promise<StaffAccount | null>;
  // Panel reviews: one row per (application, judge/reviewer) = the assignment AND that person's score sheet.
  getReviews(): Promise<PanelReview[]>;
  /** Adds many at once. Rows whose (application, panel member) pair already exists are skipped; returns how many were added. */
  createReviews(reviews: PanelReview[]): Promise<number>;
  updateReview(reviewId: string, patch: Partial<Omit<PanelReview, "reviewId" | "applicationId" | "panelEmail">>): Promise<PanelReview | null>;
  /** Many updates in one go (one Sheets request where the transport allows). Unknown ids are skipped. */
  updateReviews(changes: Array<{ reviewId: string; patch: Partial<Omit<PanelReview, "reviewId" | "applicationId" | "panelEmail">> }>): Promise<PanelReview[]>;
  // Messages to applicants (append-only: campaigns are never edited; the log only grows).
  createEmailCampaign(c: EmailCampaign): Promise<void>;
  getEmailCampaigns(): Promise<EmailCampaign[]>;
  getEmailLog(): Promise<EmailLogRow[]>;
  appendEmailLog(rows: EmailLogRow[]): Promise<void>;
  // Level 2 (invited applicants; append-only).
  getLevel2Invites(): Promise<Level2Invite[]>;
  addLevel2Invites(rows: Level2Invite[]): Promise<void>;
  getLevel2Applications(): Promise<Level2Application[]>;
  /** Throws DUPLICATE_LEVEL2 if this Level 1 code already has a Level 2 application. */
  createLevel2Application(a: Level2Application): Promise<void>;
  // Level 2 reviews (assignment + score sheet per code and reviewer).
  getLevel2Reviews(): Promise<Level2Review[]>;
  /** Skips a row whose code already has a live (not withdrawn) review. Returns how many were added. */
  createLevel2Reviews(rows: Level2Review[]): Promise<number>;
  updateLevel2Reviews(changes: Array<{ reviewId: string; patch: Partial<Omit<Level2Review, "reviewId" | "level1Code" | "reviewerEmail">> }>): Promise<Level2Review[]>;
  // Settings (the "Configuration" tab; append-only: the newest row for a key wins, older rows are the history).
  getConfiguration(): Promise<ConfigRow[]>;
  appendConfiguration(row: ConfigRow): Promise<void>;
  /** Cheap, read-only check used by /api/health?check=store. Never returns secrets. */
  diagnose(): Promise<StoreDiagnosis>;
  logEvent(event: AuditEvent): Promise<void>;
}
