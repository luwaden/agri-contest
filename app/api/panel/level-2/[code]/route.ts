import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { saveMyLevel2Review } from "@/lib/services/level2ReviewService";

export const dynamic = "force-dynamic";

/** Save my Level 2 review as a draft, or submit it with { submit: true }. Only the reviewer it is assigned to. */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const auth = await requireApiPermission("scores:submit");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const r = await saveMyLevel2Review(auth.user, (await ctx.params).code, ((await readJson(req, 10_000)) ?? {}) as Record<string, unknown>);
    return NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}
