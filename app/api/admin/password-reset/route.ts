import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { sendPasswordLink } from "@/lib/services/staffService";

export const dynamic = "force-dynamic";

/** { email, send? } → a one-time invite or reset link for a staff member, emailed to them when send is true (and always shown to the admin). */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("users:manage");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const body = ((await readJson(req, 1_000)) ?? {}) as { email?: unknown; send?: unknown };
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
    const r = await sendPasswordLink(String(body.email ?? ""), auth.user.email, origin, body.send === true);
    return NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}
