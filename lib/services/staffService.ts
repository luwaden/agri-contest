import { z } from "zod";
import { getRepository } from "@/lib/repository";
import { findStaff, hashLooksValid, invalidateStaffCache, listStaff, loadStaff, newUserId } from "@/lib/auth/users";
import { createResetToken, passwordResetAvailable, revokeSessions } from "@/lib/auth/passwords";
import type { StaffRole } from "@/types/user";
import type { StaffAccount, StaffSummary } from "@/types/staff";
import type { ServiceResult } from "./applicationService";

const ROLE = z.enum(["ADMIN", "COORDINATOR", "JUDGE", "REVIEWER"]);
const addSchema = z.object({
  name: z.string().trim().min(2, "Please enter the person's full name.").max(80, "Please keep the name under 80 characters.").regex(/^[^=+@<>]/, "Please enter a plain name."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  role: ROLE,
});
const patchSchema = z.object({ email: z.string().trim().toLowerCase().email(), role: ROLE.optional(), active: z.boolean().optional() })
  .refine((p) => p.role !== undefined || p.active !== undefined, "Nothing to change.");

type Out = { staff: StaffSummary[]; link?: string; expiresAt?: string };

/** There must always be at least one active administrator who can actually sign in. */
function keepsAnAdmin(accounts: StaffAccount[], email: string, patch: { role?: StaffRole; active?: boolean }) {
  const after = accounts.map((a) => (a.email === email ? { ...a, ...patch } : a));
  return after.some((a) => a.role === "ADMIN" && a.active && hashLooksValid(a.passwordHash));
}

export async function addStaff(input: unknown, actor: string, origin: string): Promise<ServiceResult<Out>> {
  const p = addSchema.safeParse(input);
  if (!p.success) return { ok: false, status: 400, body: { message: p.error.issues[0].message } };
  if (!passwordResetAvailable()) return { ok: false, status: 503, body: { message: "Adding people here needs Redis (Upstash) for the invite link. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or use: npm run make-user" } };
  const { name, email, role } = p.data;
  if (await findStaff(email, true)) return { ok: false, status: 409, body: { message: "Someone with that email already has an account." } };
  try {
    await getRepository().createStaff({ userId: newUserId(), name, email, role, active: true, note: `added by ${actor}`, passwordHash: "", updatedAt: new Date().toISOString(), source: "sheet" });
  } catch (e) {
    if ((e as Error).message === "DUPLICATE_EMAIL") return { ok: false, status: 409, body: { message: "Someone with that email already has an account." } };
    throw e;
  }
  invalidateStaffCache();
  const { token, expiresAt } = await createResetToken(email, "invite");
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor, action: "STAFF_ADDED", detail: `${email} as ${role}` }).catch(() => undefined);
  return { ok: true, status: 201, data: { staff: await listStaff(), link: `${origin}/reset-password?token=${token}`, expiresAt } };
}

export async function changeStaff(input: unknown, actor: string): Promise<ServiceResult<Out>> {
  const p = patchSchema.safeParse(input);
  if (!p.success) return { ok: false, status: 400, body: { message: "Please choose a valid change." } };
  const { email, role, active } = p.data;
  if (email === actor.toLowerCase()) return { ok: false, status: 400, body: { message: "You cannot change your own role or deactivate yourself. Ask another administrator." } };
  const { accounts } = await loadStaff({ fresh: true });
  const target = accounts.find((a) => a.email === email);
  if (!target) return { ok: false, status: 404, body: { message: "That account no longer exists." } };
  if (target.source === "env") return { ok: false, status: 400, body: { message: "This account is set in the ADMIN_USERS_JSON setting on Vercel. Change it there and redeploy." } };
  if (!keepsAnAdmin(accounts, email, { ...(role ? { role } : {}), ...(active !== undefined ? { active } : {}) }))
    return { ok: false, status: 400, body: { message: "That would leave no active administrator who can sign in." } };
  await getRepository().updateStaff(email, { ...(role ? { role } : {}), ...(active !== undefined ? { active } : {}) });
  if (active === false) await revokeSessions(email);
  invalidateStaffCache();
  const what = active === false ? "STAFF_DEACTIVATED" : active === true ? "STAFF_REACTIVATED" : "STAFF_ROLE_CHANGED";
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor, action: what, detail: `${email}${role ? ` → ${role}` : ""}` }).catch(() => undefined);
  return { ok: true, status: 200, data: { staff: await listStaff() } };
}
