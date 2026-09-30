import type { Permission, Role } from "@/types/user";

export const ROLE_PERMISSIONS: Record<Exclude<Role, "APPLICANT">, readonly Permission[]> = {
  ADMIN: ["applications:view", "applications:edit", "applications:status", "analytics:view", "config:manage", "judges:manage", "reports:view"],
  COORDINATOR: ["applications:view", "applications:status", "analytics:view", "reports:view"],
  JUDGE: ["applications:view", "scores:submit"],
};
export const can = (role: Exclude<Role, "APPLICANT">, p: Permission) => ROLE_PERMISSIONS[role].includes(p);
export const homeFor = (role: Exclude<Role, "APPLICANT">) => (role === "JUDGE" ? "/judge" : "/admin");
