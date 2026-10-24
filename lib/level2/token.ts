import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A short-lived pass for the Level 2 form: issued only after the person proves they hold a Level 1 code AND its email.
 * Signed with SESSION_SECRET, so it cannot be forged or edited in the browser. Valid for 3 hours.
 */
const TTL_MS = 3 * 3600_000;
const secret = () => { const s = process.env.SESSION_SECRET; if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)."); return s; };
const sign = (payload: string) => createHmac("sha256", `level2:${secret()}`).update(payload).digest("base64url");

export function issueLevel2Token(code: string, email: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ c: code, e: email, x: now + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function readLevel2Token(token: unknown, now = Date.now()): { code: string; email: string } | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(sign(payload)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try { const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return typeof p.c === "string" && typeof p.e === "string" && Number(p.x) > now ? { code: p.c, email: p.e } : null; }
  catch { return null; }
}
