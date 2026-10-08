import type { StaffRole } from "@/types/user";

/**
 * A staff sign-in account.
 *  - source "sheet": stored in the "Admin Users" tab (add/change without redeploying)
 *  - source "env":   stored in the ADMIN_USERS_JSON setting (break-glass; wins if the same email is in both)
 * passwordHash is a bcrypt hash, or "" when the person has been invited but has not set a password yet.
 */
export interface StaffAccount {
  userId: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  note: string;
  passwordHash: string;
  updatedAt: string;
  source: "sheet" | "env";
}

/** What the admin Staff page may see. Never includes the hash. */
export interface StaffSummary {
  name: string; email: string; role: StaffRole; active: boolean; source: "sheet" | "env";
  status: "active" | "invited" | "deactivated" | "damaged";
}
