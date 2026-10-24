import { NextResponse, type NextRequest } from "next/server";
import { badRequest, clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { submitLevel2 } from "@/lib/services/level2Service";

export const dynamic = "force-dynamic";

/** { pass, values, companyWebsite (honeypot) } → one row in "Level 2 Applications". */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
    const rl = await rateLimit(`level2-submit:${clientIp(req)}`, 8, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const body = (await readJson(req, 40_000)) as { pass?: unknown; values?: Record<string, unknown>; companyWebsite?: string } | null;
    if (!body?.values || typeof body.values !== "object") return badRequest("We could not read your application. Please try again.");
    if (body.companyWebsite) return NextResponse.json({ code: "received" }, { status: 201 });   // bots
    const r = await submitLevel2(body.pass, body.values);
    return NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}
