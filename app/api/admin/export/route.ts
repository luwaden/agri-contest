import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { parseFilters } from "@/lib/analytics/filters";
import { serverError } from "@/lib/http";
import { buildApplicationsCsv } from "@/lib/services/exportService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireApiPermission("export:data");
  if ("error" in auth) return auth.error;
  try {
    const { csv, rows } = await buildApplicationsCsv(parseFilters(req.nextUrl.searchParams), auth.user.email);
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store", "X-Row-Count": String(rows) } });
  } catch (e) { return serverError(e); }
}
