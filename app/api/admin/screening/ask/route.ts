import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { ask } from "@/lib/services/screeningAssistant";

export const dynamic = "force-dynamic";

/** { text } or { spec }. Answers or PROPOSES; it never changes data (actions are confirmed through /api/admin/screening). */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("judges:manage");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const rl = await rateLimit(`screen-ask:${auth.user.email}:${clientIp(req)}`, 60, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const body = ((await readJson(req, 8_000)) ?? {}) as { text?: unknown; spec?: unknown; balanced?: unknown };
    return NextResponse.json(await ask({ text: typeof body.text === "string" ? body.text : undefined, spec: body.spec, balanced: body.balanced }), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}
