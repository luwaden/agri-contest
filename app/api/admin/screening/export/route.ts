import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { getRepository } from "@/lib/repository";
import { serverError } from "@/lib/http";
import { listCsv, type ListKind } from "@/lib/services/screeningService";
import { customListCsv, balancedCsv } from "@/lib/services/screeningAssistant";

export const dynamic = "force-dynamic";
const KINDS: ListKind[] = ["shortlist", "all", "batch", "passed", "finalists"];

/** CSV downloads for each screening stage. They contain personal data, so they need the export permission and are logged. */
export async function GET(req: NextRequest) {
  const auth = await requireApiPermission("export:data");
  if ("error" in auth) return auth.error;
  const kind = req.nextUrl.searchParams.get("list") as ListKind | "custom" | "balanced";
  if (kind === "custom" || kind === "balanced") {
    try {
      let spec: unknown;
      try { spec = JSON.parse(Buffer.from(req.nextUrl.searchParams.get("spec") ?? "", "base64url").toString("utf8")); }
      catch { return NextResponse.json({ message: "The list settings could not be read. Build the list again." }, { status: 422 }); }
      const { csv, rows, filename, description } = kind === "balanced" ? await balancedCsv(spec) : await customListCsv(spec);
      await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor: auth.user.email, action: "SCREENING_EXPORT", detail: `${kind} (${rows} rows): ${description}`.slice(0, 480) }).catch(() => {});
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store", "X-Row-Count": String(rows) } });
    } catch (e) { if ((e as Error)?.name === "ZodError") return NextResponse.json({ message: "The list settings are not valid." }, { status: 422 }); return serverError(e); }
  }
  if (!KINDS.includes(kind)) return NextResponse.json({ message: "Unknown list." }, { status: 422 });
  const n = Number(req.nextUrl.searchParams.get("size"));
  const size = Number.isInteger(n) && n > 0 && n <= 20_000 ? n : undefined;
  try {
    const { csv, rows, filename } = await listCsv(kind, size);
    await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor: auth.user.email, action: "SCREENING_EXPORT", detail: `${kind} (${rows} rows)` }).catch(() => {});
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store", "X-Row-Count": String(rows) } });
  } catch (e) { return serverError(e); }
}
