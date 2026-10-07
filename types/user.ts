export type Role = "ADMIN" | "COORDINATOR" | "JUDGE" | "APPLICANT";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Exclude<Role, "APPLICANT">;
}

export type Permission =
  | "applications:view"
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
