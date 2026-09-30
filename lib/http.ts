import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/** Simple fixed-window limiter. In-memory: per server instance. Use Redis/Upstash when running multiple instances. */
const hits = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { count: 1, reset: now + windowMs }); if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k); return { ok: true, retryAfter: 0 }; }
  h.count += 1;
  return { ok: h.count <= limit, retryAfter: Math.ceil((h.reset - now) / 1000) };
}

export const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";

export const tooMany = (retryAfter: number) =>
  NextResponse.json({ message: "Too many attempts. Please wait a few minutes and try again." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

/** CSRF defence for cookie-authenticated mutations: same-origin requests only. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production"; // non-browser clients (tests) only outside production
  try { return new URL(origin).host === req.headers.get("host"); } catch { return false; }
}

export async function readJson(req: NextRequest, maxBytes = 64_000): Promise<unknown | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export const badRequest = (message: string, extra: object = {}) => NextResponse.json({ message, ...extra }, { status: 400 });
export const serverError = (e: unknown) => {
  console.error("[api]", e);
  return NextResponse.json({ message: "Something went wrong on our side. Please try again in a moment." }, { status: 500 });
};
