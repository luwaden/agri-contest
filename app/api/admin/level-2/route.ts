import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { inviteLevel2, level2Csv } from "@/lib/services/level2Service";
import { getRepository } from "@/lib/repository";

export const dynamic = "force-dynamic";

/** CSV of all Level 2 applications (personal data: export permission, logged). */
export async function GET() {
  const auth = await requireApiPermission("export:data");
  if ("error" in auth) return auth.error;
  try {
    const { csv, rows } = await level2Csv();
    await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor: auth.user.email, action: "LEVEL2_EXPORT", detail: `${rows} rows` }).catch(() => {});
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="level-2-applications-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}

/** { codes: "AGRA-… AGRA-…", note? } → added to the Level 2 invite list. */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("applications:status");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const b = ((await readJson(req, 250_000)) ?? {}) as { codes?: unknown; note?: unknown };
    const r = await inviteLevel2(b.codes, auth.user.email, typeof b.note === "string" ? b.note : "");
    return NextResponse.json(r.ok ? r.data : r.body, { status: r.status });
  } catch (e) { return serverError(e); }
}
