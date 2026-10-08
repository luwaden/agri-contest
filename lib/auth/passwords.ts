import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { kv, redisConfigured } from "@/lib/kv";

/**
 * One-time password links, without email or redeploys.
 *  - "reset":  for someone who forgot their password (valid 30 minutes)
 *  - "invite": for someone just added on the Staff page, to choose their first password (valid 48 hours)
 * An administrator creates the link and sends it privately. The link works once.
 * Requires Redis: links must be shared between Vercel's server instances, so without Redis the feature is off.
 */
export const LINK_MINUTES = { reset: 30, invite: 48 * 60 } as const;
export type LinkPurpose = keyof typeof LINK_MINUTES;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const norm = (e: string) => e.trim().toLowerCase();

export const passwordResetAvailable = () => redisConfigured();

/** A newer password set through a link for an account that lives in ADMIN_USERS_JSON, if any. */
export async function getPasswordOverride(email: string): Promise<string | null> {
  if (!redisConfigured()) return null;
  return kv.get(`pw:${norm(email)}`);
}

export async function createResetToken(email: string, purpose: LinkPurpose = "reset"): Promise<{ token: string; expiresAt: string; purpose: LinkPurpose }> {
  const token = randomBytes(32).toString("base64url");
  const minutes = LINK_MINUTES[purpose];
  await kv.set(`pwreset:${sha(token)}`, JSON.stringify({ email: norm(email), purpose }), { ex: minutes * 60 });
  return { token, expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(), purpose };
}

/** Reads a link without using it (so the page can greet the person or say the link has expired). */
export async function peekResetToken(token: string): Promise<{ email: string; purpose: LinkPurpose } | null> {
  if (typeof token !== "string" || token.length < 30 || token.length > 100) return null;
  const raw = await kv.get(`pwreset:${sha(token)}`);
  if (!raw) return null;
  try { const v = JSON.parse(raw); if (v && typeof v.email === "string") return { email: v.email, purpose: v.purpose === "invite" ? "invite" : "reset" }; } catch { /* older links stored the plain email */ }
  return { email: raw, purpose: "reset" };
}

const COMMON = new Set(["password123", "password1234", "1234567890", "qwertyuiop", "agrismedan2026", "admin12345"]);
export function passwordProblem(pw: string, email?: string): string | null {
  if (typeof pw !== "string" || pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 200) return "That password is too long.";
  if (/^(.)\1+$/.test(pw) || COMMON.has(pw.toLowerCase())) return "That password is too easy to guess. Choose another.";
  if (email && pw.toLowerCase().includes(norm(email).split("@")[0])) return "Do not use your email name in your password.";
  return null;
}

/** Signs out every session of this person that started before now. */
export async function revokeSessions(email: string) { await kv.set(`pwchanged:${norm(email)}`, String(Date.now())); }

type HashStore = (email: string, hash: string) => Promise<void>;
const redisStore: HashStore = async (email, hash) => { await kv.set(`pw:${email}`, hash); };

/**
 * Uses the link once. A weak password leaves the link valid; a stored password consumes it.
 * `store` decides where the new hash goes (the sheet for sheet accounts, Redis for ADMIN_USERS_JSON accounts).
 */
export async function consumeResetToken(token: string, newPassword: string, store: HashStore = redisStore): Promise<{ ok: true; email: string; purpose: LinkPurpose } | { ok: false; message: string }> {
  if (typeof token !== "string" || token.length < 30 || token.length > 100) return { ok: false, message: "This link is not valid. Ask an administrator for a new one." };
  const link = await peekResetToken(token);
  if (!link) return { ok: false, message: "This link has expired or has already been used. Ask an administrator for a new one." };
  const problem = passwordProblem(newPassword, link.email);
  if (problem) return { ok: false, message: problem };
  try { await store(link.email, await bcrypt.hash(newPassword, 12)); }
  catch (e) {
    if ((e as Error).message === "NO_ACCOUNT") return { ok: false, message: "This account no longer exists. Ask an administrator." };
    throw e;
  }
  await kv.del(`pwreset:${sha(token)}`);          // single use
  await revokeSessions(link.email);                // sign out every older session
  return { ok: true, email: link.email, purpose: link.purpose };
}

/** True if the session was issued before the person's password last changed (or they were deactivated). */
export async function sessionRevoked(email: string, issuedAtSec?: number): Promise<boolean> {
  if (!redisConfigured() || !issuedAtSec) return false;
  const changed = Number(await kv.get(`pwchanged:${norm(email)}`));
  return Number.isFinite(changed) && changed > 0 && issuedAtSec * 1000 < changed - 1000;
}
