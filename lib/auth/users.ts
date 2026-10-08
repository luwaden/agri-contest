import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { SessionUser, StaffRole } from "@/types/user";
import type { StaffAccount, StaffSummary } from "@/types/staff";
import { getRepository } from "@/lib/repository";
import { kv } from "@/lib/kv";
import { consumeResetToken, getPasswordOverride, revokeSessions } from "./passwords";

/**
 * STAFF ACCOUNTS come from two places:
 *  1. the "Admin Users" tab of the Google Sheet (normal way: added from Admin → Staff or `npm run make-user`, no redeploy)
 *  2. the ADMIN_USERS_JSON setting (break-glass; if an email is in both, this one wins)
 * Only bcrypt hashes are ever stored.
 */
export const STAFF_ROLES: StaffRole[] = ["ADMIN", "COORDINATOR", "JUDGE", "REVIEWER"];
const BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const norm = (e: string) => e.trim().toLowerCase();

/** Accepts a bcrypt hash as-is, or "b64:<base64 of the hash>" (no $ signs, so .env files cannot damage it). */
export function decodeHash(raw: string): string {
  const v = (raw ?? "").trim();
  if (v.startsWith("b64:")) { try { return Buffer.from(v.slice(4), "base64").toString("utf8"); } catch { return ""; } }
  return v;
}
export const hashLooksValid = (h: string) => BCRYPT.test(h);
/** Hash in a form that is safe to paste anywhere (.env files, Vercel, PowerShell). */
export const envSafeHash = (h: string) => `b64:${Buffer.from(h, "utf8").toString("base64")}`;

export interface EnvParse { accounts: StaffAccount[]; error: string | null; damaged: string[] }

/** Reads ADMIN_USERS_JSON and explains anything wrong with it in plain words. */
export function parseEnvAccounts(raw = process.env.ADMIN_USERS_JSON): EnvParse {
  if (!raw || !raw.trim()) return { accounts: [], error: null, damaged: [] };
  let list: unknown;
  try { list = JSON.parse(raw); }
  catch { return { accounts: [], error: "ADMIN_USERS_JSON is not valid JSON. It must be ONE line starting with [ and ending with ]. In a .env file a value split over several lines is cut off.", damaged: [] }; }
  if (!Array.isArray(list)) return { accounts: [], error: "ADMIN_USERS_JSON must be a list: [ {...}, {...} ].", damaged: [] };
  const damaged: string[] = []; const accounts: StaffAccount[] = [];
  for (const u of list as Array<Record<string, unknown>>) {
    const email = norm(String(u?.email ?? "")); const role = String(u?.role ?? "").toUpperCase() as StaffRole;
    if (!email || !STAFF_ROLES.includes(role)) continue;
    const hash = decodeHash(String(u.passwordHash ?? ""));
    if (!hashLooksValid(hash)) damaged.push(email);
    accounts.push({ userId: String(u.id ?? email), name: String(u.name ?? email), email, role, active: u.active !== false, note: "", passwordHash: hash, updatedAt: "", source: "env" });
  }
  return { accounts, error: null, damaged };
}

// ── sheet accounts, cached briefly so every page view does not read the sheet ──
let cache: { at: number; list: StaffAccount[] } | null = null;
let lastFresh = 0;
const TTL = 30_000;
export const invalidateStaffCache = () => { cache = null; };

async function sheetAccounts(fresh = false): Promise<{ list: StaffAccount[]; ok: boolean }> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return { list: cache.list, ok: true };
  try {
    const list = await getRepository().getStaff();
    cache = { at: Date.now(), list }; return { list, ok: true };
  } catch (e) {
    console.error("[auth] could not read staff accounts from the data store:", (e as Error).message);
    return { list: cache?.list ?? [], ok: Boolean(cache) };
  }
}

/** All accounts, env first (env wins on the same email). `ok:false` means the sheet could not be read. */
export async function loadStaff(opts: { fresh?: boolean } = {}): Promise<{ accounts: StaffAccount[]; ok: boolean; envError: string | null; damaged: string[] }> {
  const env = parseEnvAccounts();
  const sheet = await sheetAccounts(opts.fresh);
  const seen = new Set(env.accounts.map((a) => a.email));
  const accounts = [...env.accounts, ...sheet.list.filter((a) => !seen.has(a.email))];
  const damaged = [...env.damaged, ...sheet.list.filter((a) => a.passwordHash && !hashLooksValid(a.passwordHash)).map((a) => a.email)];
  return { accounts, ok: sheet.ok, envError: env.error, damaged };
}

export async function findStaff(email: string, fresh = false): Promise<StaffAccount | null> {
  const e = norm(email);
  let { accounts } = await loadStaff({ fresh });
  let hit = accounts.find((a) => a.email === e) ?? null;
  // Someone may have just been added from another computer or server: look again, at most every 10 seconds.
  if (!hit && !fresh && Date.now() - lastFresh > 10_000) { lastFresh = Date.now(); accounts = (await loadStaff({ fresh: true })).accounts; hit = accounts.find((a) => a.email === e) ?? null; }
  return hit;
}

export const summarise = (a: StaffAccount): StaffSummary => ({
  name: a.name, email: a.email, role: a.role, active: a.active, source: a.source,
  status: !a.active ? "deactivated" : !a.passwordHash ? "invited" : !hashLooksValid(a.passwordHash) ? "damaged" : "active",
});

/** Staff list for the admin Staff page: never includes hashes. */
export async function listStaff(): Promise<StaffSummary[]> {
  return (await loadStaff({ fresh: true })).accounts.map(summarise).sort((x, y) => x.role.localeCompare(y.role) || x.name.localeCompare(y.name));
}

// Constant-time-ish behaviour for unknown emails
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.4zFq3qIuF6Jd5o7oB7R0nY1Zb6F2";
const dev = process.env.NODE_ENV !== "production";

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const user = await findStaff(email);
  // A password set through a link is stored in Redis for env accounts; for sheet accounts it is written to the sheet.
  const override = user ? await getPasswordOverride(user.email) : null;
  const hash = override ?? user?.passwordHash ?? "";
  const ok = await bcrypt.compare(password, hashLooksValid(hash) ? hash : DUMMY_HASH);
  if (!user) {
    const { accounts } = await loadStaff();
    if (accounts.length === 0) console.warn("[auth] Sign-in refused: no staff accounts exist yet. Create one with: npm run make-user -- \"you@example.org\" \"Your Name\" ADMIN \"a-long-password\"");
    else if (dev) console.warn(`[auth] Sign-in refused: no staff account for "${norm(email)}" (not in ADMIN_USERS_JSON and not in the Admin Users tab).`);
    return null;
  }
  if (!hashLooksValid(hash)) {
    console.warn(`[auth] Sign-in refused for ${user.email}: ${user.passwordHash ? "the stored password hash is damaged (in a .env file the $ signs were probably removed). Run npm run make-user again for this person." : "no password has been set yet. Send them an invite link from Admin → Staff."}`);
    return null;
  }
  if (!ok) return null;
  if (!user.active) { console.warn(`[auth] Sign-in refused for ${user.email}: account is deactivated.`); return null; }
  return { id: user.userId || user.email, name: user.name, email: user.email, role: user.role };
}

/**
 * Re-checks a signed-in person on every request (cached 30 s): deactivated or deleted accounts lose access at once,
 * and role or name changes apply without signing in again. If the sheet cannot be read at all, sessions stay valid.
 */
export async function refreshSessionUser(u: SessionUser): Promise<SessionUser | null> {
  const { accounts, ok } = await loadStaff();
  const a = accounts.find((x) => x.email === norm(u.email));
  if (!a) return ok ? null : u;
  if (!a.active) return null;
  return { ...u, role: a.role, name: a.name };
}

/** Uses a one-time link to set a password, storing it where the account lives. */
export async function completePasswordLink(token: string, newPassword: string) {
  return consumeResetToken(token, newPassword, async (email, hash) => {
    const acct = await findStaff(email, true);
    if (!acct) throw new Error("NO_ACCOUNT");
    if (acct.source === "sheet") {
      const updated = await getRepository().updateStaff(email, { passwordHash: hash });
      if (!updated) throw new Error("NO_ACCOUNT");
      await kv.del(`pw:${email}`);            // the sheet is now the single source for this person's password
    } else {
      await kv.set(`pw:${email}`, hash);       // env accounts cannot be edited at runtime, so the new hash lives in Redis
    }
    invalidateStaffCache();
  });
}

export const newUserId = () => `U-${randomBytes(4).toString("hex").toUpperCase()}`;

/** Creates or updates a sheet account (used by `npm run make-user`). Returns what happened. */
export async function upsertSheetAccount(input: { email: string; name: string; role: StaffRole; password?: string; note?: string }): Promise<"created" | "updated"> {
  const repo = getRepository();
  const email = norm(input.email);
  const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
  const existing = (await repo.getStaff()).find((a) => a.email === email);
  if (existing) {
    await repo.updateStaff(email, { name: input.name, role: input.role, active: true, ...(passwordHash ? { passwordHash } : {}), ...(input.note ? { note: input.note } : {}) });
    if (passwordHash) { await kv.del(`pw:${email}`); await revokeSessions(email); }
    invalidateStaffCache(); return "updated";
  }
  await repo.createStaff({ userId: newUserId(), name: input.name, email, role: input.role, active: true, note: input.note ?? "", passwordHash: passwordHash ?? "", updatedAt: new Date().toISOString(), source: "sheet" });
  invalidateStaffCache(); return "created";
}
