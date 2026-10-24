import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { startLevel2 } from "@/lib/services/level2Service";

export const dynamic = "force-dynamic";

/** { code, email } → a 3-hour pass and the answers already known from Level 1. Rate-limited against guessing. */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
    const rl = await rateLimit(`level2-start:${clientIp(req)}`, 10, 15 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const r = await startLevel2(((await readJson(req, 2_000)) ?? {}) as { code?: unknown; email?: unknown });
    return NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}
