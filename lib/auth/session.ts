import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "@/types/user";

export const SESSION_COOKIE = "agri_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime(`${MAX_AGE_SECONDS}s`).sign(secret());
}

export async function verifySessionToken(token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || !payload.email || !payload.role) return null;
    return { id: payload.sub, name: String(payload.name), email: String(payload.email), role: payload.role as SessionUser["role"] };
  } catch { return null; }
}

export const sessionCookieOptions = {
  httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_SECONDS,
};
