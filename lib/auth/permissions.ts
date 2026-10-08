import type { Permission, StaffRole } from "@/types/user";

/**
 * WHO CAN DO WHAT. This table is the single source of truth: every page and API route checks it on the server.
 *
 *  ADMIN        everything: applicants, analytics, export, mentors/panel applications, AI analytics, status changes
 *  COORDINATOR  runs the programme day to day: same as admin except settings; also AI analytics
 *  JUDGE        scores ONLY the applications assigned to them (finale / later rounds); sees no lists, totals or exports
 *  REVIEWER     scores ONLY the applications assigned to them (screening rounds); same limits as a judge
 */
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  ADMIN: ["applications:view", "applications:edit", "applications:status", "analytics:view", "config:manage", "judges:manage", "reports:view", "mentors:review", "ai:query", "export:data", "assistant:staff", "users:manage"],
  COORDINATOR: ["applications:view", "applications:status", "analytics:view", "reports:view", "mentors:review", "export:data", "ai:query", "assistant:staff"],
  JUDGE: ["applications:view-assigned", "scores:submit", "assistant:staff"],
  REVIEWER: ["applications:view-assigned", "scores:submit", "assistant:staff"],
};
export const STAFF_ROLES = Object.keys(ROLE_PERMISSIONS) as StaffRole[];
export const can = (role: StaffRole, p: Permission) => ROLE_PERMISSIONS[role].includes(p);
export const isPanelRole = (role: StaffRole) => role === "JUDGE" || role === "REVIEWER";
export const homeFor = (role: StaffRole) => (role === "JUDGE" ? "/judge" : role === "REVIEWER" ? "/review" : "/admin");
export const roleLabel = (role: StaffRole) => ({ ADMIN: "Administrator", COORDINATOR: "Programme coordinator", JUDGE: "Judge", REVIEWER: "Reviewer" })[role];
