import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { badRequest, clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { parseFilters } from "@/lib/analytics/filters";
import { askAI } from "@/lib/services/aiService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("ai:query");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const rl = rateLimit(`ai:${auth.user.email}:${clientIp(req)}`, 20, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const body = (await readJson(req, 4_000)) as { question?: string; filters?: Record<string, string> } | null;
    if (!body?.question || typeof body.question !== "string") return badRequest("Please type a question.");
    const r = await askAI(body.question, parseFilters(body.filters ?? {}), auth.user.email);
    return r.ok ? NextResponse.json(r.data) : NextResponse.json(r.body, { status: r.status });
  } catch (e) { return serverError(e); }
}
