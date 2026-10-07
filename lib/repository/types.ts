import type { Application, ApplicationStatus } from "@/types/application";
import type { MentorApplication, MentorStatus } from "@/types/mentor";

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
  logEvent(event: AuditEvent): Promise<void>;
}
