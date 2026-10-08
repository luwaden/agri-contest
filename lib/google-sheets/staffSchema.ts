import type { StaffAccount } from "@/types/staff";
import type { StaffRole } from "@/types/user";

/**
 * "Admin Users" tab. The first six headers existed before (reserved); password_hash and updated_at are APPENDED,
 * so an older sheet keeps working and `npm run setup:sheets` only adds the two new column titles.
 * Only bcrypt hashes are stored, never passwords.
 */
export const STAFF_HEADERS = ["user_id", "name", "email", "role", "active", "note", "password_hash", "updated_at"] as const;

const ROLES: StaffRole[] = ["ADMIN", "COORDINATOR", "JUDGE", "REVIEWER"];
const guard = (s: string) => (/^[=+\-@]/.test(s) ? `'${s}` : s);
const unguard = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

export const staffToRow = (a: StaffAccount): string[] => [
  a.userId, guard(a.name), a.email.toLowerCase(), a.role, a.active ? "TRUE" : "FALSE", guard(a.note), a.passwordHash, a.updatedAt,
];

/** Returns null for blank or unusable rows (e.g. a role typed by hand that the app does not know). */
export function rowToStaff(r: string[]): StaffAccount | null {
  const email = (r[2] ?? "").trim().toLowerCase();
  const role = (r[3] ?? "").trim().toUpperCase() as StaffRole;
  if (!email || !ROLES.includes(role)) return null;
  return {
    userId: r[0] ?? "", name: unguard(r[1] ?? "").trim() || email, email, role,
    active: (r[4] ?? "TRUE").trim().toUpperCase() !== "FALSE", note: unguard(r[5] ?? ""),
    passwordHash: (r[6] ?? "").trim(), updatedAt: r[7] ?? "", source: "sheet",
  };
}
