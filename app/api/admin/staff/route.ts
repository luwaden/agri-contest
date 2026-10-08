import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { addStaff, changeStaff } from "@/lib/services/staffService";

export const dynamic = "force-dynamic";
const origin = (req: NextRequest) => process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;

/** Add a person: creates their account in the Admin Users tab and returns a one-time invite link. */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("users:manage");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try { const r = await addStaff(await readJson(req, 2_000), auth.user.email, origin(req)); return r.ok ? NextResponse.json(r.data, { status: r.status, headers: { "Cache-Control": "no-store" } }) : NextResponse.json(r.body, { status: r.status }); }
  catch (e) { return serverError(e); }
}

/** Change role, or deactivate / reactivate. */
export async function PATCH(req: NextRequest) {
  const auth = await requireApiPermission("users:manage");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try { const r = await changeStaff(await readJson(req, 1_000), auth.user.email); return r.ok ? NextResponse.json(r.data) : NextResponse.json(r.body, { status: r.status }); }
  catch (e) { return serverError(e); }
}
