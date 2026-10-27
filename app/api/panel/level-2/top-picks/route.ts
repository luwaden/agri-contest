import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { saveMyTopPicks } from "@/lib/services/level2ReviewService";

export const dynamic = "force-dynamic";

/** Save my top 3 Level 2 applicants: { picks: [{ code, reason }, …] } in rank order. Only my own submitted reviews. */
export async function PUT(req: NextRequest) {
  const auth = await requireApiPermission("scores:submit");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const r = await saveMyTopPicks(auth.user, ((await readJson(req, 10_000)) ?? {}) as Record<string, unknown>);
    return NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}
