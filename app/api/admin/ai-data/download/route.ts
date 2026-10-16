import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { getOutput } from "@/lib/services/aiDataDesk";

export const dynamic = "force-dynamic";

/** CSV copy of a sheet the AI data desk created (kept for 3 hours on this server). */
export async function GET(req: NextRequest) {
  const auth = await requireApiPermission("ai:data");
  if ("error" in auth) return auth.error;
  const o = getOutput(req.nextUrl.searchParams.get("id") ?? "");
  if (!o) return NextResponse.json({ message: "That download has expired. Ask again, or open the tab in Google Sheets." }, { status: 404 });
  const name = o.title.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "ai-results";
  return new NextResponse(o.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "no-store" } });
}
