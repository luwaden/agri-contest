import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { askDataDesk } from "@/lib/services/aiDataDesk";
import type { AIMessage } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** { question, history? }. Administrators only. Reads data; the only thing it can write is a NEW "AI ·" tab. */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("ai:data");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const rl = await rateLimit(`ai-data:${auth.user.email}:${clientIp(req)}`, 30, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const body = ((await readJson(req, 40_000)) ?? {}) as { question?: unknown; history?: unknown };
    const history = (Array.isArray(body.history) ? body.history : []).filter((m): m is AIMessage => !!m && typeof m === "object" && ((m as AIMessage).role === "user" || (m as AIMessage).role === "assistant") && typeof (m as AIMessage).content === "string");
    const r = await askDataDesk(typeof body.question === "string" ? body.question : "", history, auth.user.email);
    return r.ok ? NextResponse.json(r.data, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ message: r.message }, { status: r.status });
  } catch (e) { return serverError(e); }
}
