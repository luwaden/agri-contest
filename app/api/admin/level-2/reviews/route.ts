import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { getRepository } from "@/lib/repository";
import { confirmShare, level2ReviewCsv, moveTo, previewShare, reopen, unassign } from "@/lib/services/level2ReviewService";

export const dynamic = "force-dynamic";
const send = (r: { ok: boolean; status: number; data?: unknown; body?: unknown }) => NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

/** CSV of every Level 2 applicant with its reviewer, scores and decision (export permission, logged). */
export async function GET() {
  const auth = await requireApiPermission("export:data");
  if ("error" in auth) return auth.error;
  try {
    const { csv, rows } = await level2ReviewCsv();
    await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor: auth.user.email, action: "LEVEL2_REVIEW_EXPORT", detail: `${rows} rows` }).catch(() => {});
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="level-2-reviews-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}

/** { action: "preview" | "share", reviewers, byState } · { action: "move", codes, to } · { action: "unassign", codes } · { action: "reopen", code } */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("judges:manage");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const b = ((await readJson(req, 100_000)) ?? {}) as Record<string, unknown>;
    switch (b.action) {
      case "preview": return send(await previewShare(b));
      case "share": return send(await confirmShare(b, auth.user.email));
      case "move": return send(await moveTo(b, auth.user.email));
      case "unassign": return send(await unassign(b, auth.user.email));
      case "reopen": return send(await reopen(b, auth.user.email));
      default: return NextResponse.json({ message: "Unknown action." }, { status: 422 });
    }
  } catch (e) { return serverError(e); }
}
