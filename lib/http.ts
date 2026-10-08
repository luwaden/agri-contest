import "server-only";
import { NextResponse, type NextRequest } from "next/server";

import { kv } from "@/lib/kv";

/**
 * Fixed-window rate limiter. Uses Redis when configured so the limit holds across ALL server instances
 * (on Vercel every request may hit a different one); falls back to per-instance memory otherwise.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfter: number }> {
  const ttl = Math.max(1, Math.ceil(windowMs / 1000));
  const k = `rl:${key}`;
  const n = await kv.incr(k, ttl);
  if (n <= limit) return { ok: true, retryAfter: 0 };
  const left = await kv.ttl(k);
  return { ok: false, retryAfter: left > 0 ? left : ttl };
}

/** Behind Render/Vercel the platform sets x-forwarded-for. Only trust it when TRUST_PROXY=true (default off locally). */
export const clientIp = (req: NextRequest) => {
  if (process.env.TRUST_PROXY !== "true" && process.env.NODE_ENV === "production") return req.headers.get("x-real-ip") || "unknown";
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
};

export const tooMany = (retryAfter: number) =>
  NextResponse.json({ message: "Too many attempts. Please wait a few minutes and try again." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

/**
 * CSRF defence for cookie-authenticated or state-changing requests: same-origin only, plus any origins listed in
 * CORS_ALLOWED_ORIGINS (comma separated; needed only if the frontend is later hosted separately from the API).
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production"; // non-browser clients (tests) only outside production
  const allowed = (process.env.CORS_ALLOWED_ORIGINS || "").split(",").map((x) => x.trim()).filter(Boolean);
  try { return new URL(origin).host === req.headers.get("host") || allowed.includes(origin); } catch { return false; }
}

export async function readJson(req: NextRequest, maxBytes = 64_000): Promise<unknown | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export const badRequest = (message: string, extra: object = {}) => NextResponse.json({ message, ...extra }, { status: 400 });

/**
 * Turns a technical failure into a short, non-sensitive code so a 500 can be diagnosed without exposing details.
 * The full error is always written to the server log together with the same `ref`.
 */
export function classifyError(e: unknown): string {
  const any = e as { message?: string; code?: string | number; response?: { status?: number; data?: { error?: { message?: string; status?: string } } } };
  const text = `${any?.message ?? ""} ${any?.response?.data?.error?.message ?? ""} ${any?.response?.data?.error?.status ?? ""} ${any?.code ?? ""}`;
  const status = any?.response?.status;
  if (/DATA_BACKEND=local is not allowed|not configured|Set GOOGLE_SHEET_ID/i.test(text)) return "STORE_NOT_CONFIGURED";
  if (/key problem|DECODER|invalid_grant|Invalid JWT|private key/i.test(text)) return "GOOGLE_KEY";
  if (status === 403 || /PERMISSION_DENIED|does not have permission/i.test(text)) return "SHEET_NOT_SHARED";
  if (status === 404 || /Requested entity was not found/i.test(text)) return "SHEET_NOT_FOUND";
  if (/Unable to parse range|tab .* missing|sheet missing/i.test(text)) return "SHEET_TAB_MISSING";
  if (status === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(text)) return "SHEET_QUOTA";
  if (/Apps Script|non-JSON|forbidden/i.test(text)) return "APPS_SCRIPT";
  if (/ENOTFOUND|ETIMEDOUT|ECONN|fetch failed|timeout|aborted|AbortError/i.test(text)) return "NETWORK";
  return "UNKNOWN";
}

export const serverError = (e: unknown) => {
  const code = classifyError(e);
  const ref = Math.random().toString(36).slice(2, 8).toUpperCase();
  console.error(`[api] ref=${ref} code=${code}`, e);
  return NextResponse.json({ message: "Something went wrong on our side. Please try again in a moment.", code, ref }, { status: 500 });
};
