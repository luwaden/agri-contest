import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { createBatch, moveReviews, sendPassedToJudges } from "@/lib/services/screeningService";
import { invalidateAdminCache } from "@/lib/services/analyticsService";

export const dynamic = "force-dynamic";
const send = (r: { ok: boolean; status: number; data?: unknown; body?: unknown }) => NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

/**
 * { action: "batch", shortlistSize, size, reviewerEmails[], dryRun }   pick the review batch and share it out
 * { action: "move", reviewIds[], to: email | "EVEN" }                  move work between panel members
 * { action: "judges", perApplication, dryRun }                         send the passed applications to the judges
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("judges:manage");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const body = ((await readJson(req, 80_000)) ?? {}) as Record<string, unknown>;
    const actor = auth.user.email;
    if (body.action === "batch") return send(await createBatch(body, actor));
    if (body.action === "move") return send(await moveReviews(body, actor));
    if (body.action === "judges") return send(await sendPassedToJudges(body, actor));
    if (body.action === "refresh") { invalidateAdminCache(); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ message: "Unknown action." }, { status: 422 });
  } catch (e) { return serverError(e); }
}
