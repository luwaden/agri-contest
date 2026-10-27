import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { kv, redisConfigured } from "@/lib/kv";

/**
 * One-time password links: "invite" (choose a first password, 7 days) and "reset" (forgot password, 60 minutes).
 *
 * A link is signed with SESSION_SECRET, so it needs no database or Redis and cannot be forged or edited. It carries a
 * fingerprint of the person's current password: once a password is set, every older link stops working (single use).
 */
export const LINK_MINUTES = { reset: 60, invite: 7 * 24 * 60 } as const;
export type LinkPurpose = keyof typeof LINK_MINUTES;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const norm = (e: string) => e.trim().toLowerCase();
const secret = () => { const s = process.env.SESSION_SECRET; if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)."); return s; };
const sign = (payload: string) => createHmac("sha256", `pwlink:${secret()}`).update(payload).digest("base64url");
const fingerprint = (hash: string) => sha(`fp:${hash || "none"}`).slice(0, 16);

/** Where a person's current password hash is read from. users.ts passes the real lookup (sheet + overrides). */
export type HashOf = (email: string) => Promise<string>;
const kvHashOf: HashOf = async (email) => (await kv.get(`pw:${norm(email)}`)) ?? "";

/** Links work whenever SESSION_SECRET is set (Redis is no longer needed). */
export const passwordResetAvailable = () => (process.env.SESSION_SECRET ?? "").length >= 32;

/** A newer password set through a link for an account that lives in ADMIN_USERS_JSON, if any. */
export async function getPasswordOverride(email: string): Promise<string | null> {
  if (!redisConfigured()) return null;
  return kv.get(`pw:${norm(email)}`);
}

export async function createResetToken(email: string, purpose: LinkPurpose = "reset", hashOf: HashOf = kvHashOf): Promise<{ token: string; expiresAt: string; purpose: LinkPurpose }> {
  const e = norm(email), x = Date.now() + LINK_MINUTES[purpose] * 60_000;
  const payload = Buffer.from(JSON.stringify({ e, p: purpose, x, f: fingerprint(await hashOf(e)) })).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(x).toISOString(), purpose };
}

/** Checks a link without using it (so the page can greet the person or say the link has expired or been used). */
export async function peekResetToken(token: string, hashOf: HashOf = kvHashOf): Promise<{ email: string; purpose: LinkPurpose } | null> {
  if (typeof token !== "string" || token.length < 30 || token.length > 600) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const v = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof v.e !== "string" || !(Number(v.x) > Date.now())) return null;
    if (v.f !== fingerprint(await hashOf(v.e))) return null;   // a password was set since: the link is used up
    return { email: v.e, purpose: v.p === "invite" ? "invite" : "reset" };
  } catch { return null; }
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

/** Uses the link. A weak password leaves the link valid; a stored password changes the fingerprint, so the link is used up. */
export async function consumeResetToken(token: string, newPassword: string, store: HashStore = redisStore, hashOf: HashOf = kvHashOf): Promise<{ ok: true; email: string; purpose: LinkPurpose } | { ok: false; message: string }> {
  if (typeof token !== "string" || token.length < 30 || token.length > 600) return { ok: false, message: "This link is not valid. Ask an administrator for a new one." };
  const link = await peekResetToken(token, hashOf);
  if (!link) return { ok: false, message: "This link has expired or has already been used. Ask an administrator for a new one." };
  const problem = passwordProblem(newPassword, link.email);
  if (problem) return { ok: false, message: problem };
  try { await store(link.email, await bcrypt.hash(newPassword, 12)); }
  catch (e) {
    if ((e as Error).message === "NO_ACCOUNT") return { ok: false, message: "This account no longer exists. Ask an administrator." };
    if ((e as Error).message === "ENV_NEEDS_REDIS") return { ok: false, message: "This account is set in the server settings (ADMIN_USERS_JSON). Its password can only be changed there." };
    throw e;
  }
  await revokeSessions(link.email);                // sign out every older session
  return { ok: true, email: link.email, purpose: link.purpose };
}

/** True if the session was issued before the person's password last changed (or they were deactivated). */
export async function sessionRevoked(email: string, issuedAtSec?: number): Promise<boolean> {
  if (!redisConfigured() || !issuedAtSec) return false;
  const changed = Number(await kv.get(`pwchanged:${norm(email)}`));
  return Number.isFinite(changed) && changed > 0 && issuedAtSec * 1000 < changed - 1000;
}
