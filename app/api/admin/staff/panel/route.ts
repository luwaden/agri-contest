import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { invitePanel } from "@/lib/services/staffService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** { people: [{ mentorId, role }], send? } → staff accounts for chosen panel applicants, each emailed an invite link. Administrators only. */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("users:manage");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
    const r = await invitePanel(await readJson(req, 10_000), auth.user.email, origin);
    return NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}
