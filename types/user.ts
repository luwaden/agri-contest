export type Role = "ADMIN" | "COORDINATOR" | "JUDGE" | "REVIEWER" | "APPLICANT";
export type StaffRole = Exclude<Role, "APPLICANT">;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  /** When the session was issued (seconds). Used to sign people out after a password reset. */
  iat?: number;
}

export type Permission =
  | "applications:view"          // every application (admin, coordinator)
  | "applications:view-assigned" // only applications assigned to this person (judges, reviewers)
  | "assistant:staff"
  | "users:manage"
  | "applications:edit"
  | "applications:status"
  | "analytics:view"
  | "config:manage"
  | "judges:manage"
  | "reports:view"
  | "scores:submit"
  | "mentors:review"
  | "ai:query"
  | "export:data";
