import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { rateLimit, sameOrigin, serverError, tooMany } from "@/lib/http";
import { runSystemCheck } from "@/lib/services/systemCheck";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("reports:view");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  const rl = await rateLimit(`syscheck:${auth.user.email}`, 6, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  try { return NextResponse.json(await runSystemCheck(auth.user.email), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return serverError(e); }
}
