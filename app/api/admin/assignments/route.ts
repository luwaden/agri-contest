import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { assignOne, autoAssign, changeReview } from "@/lib/services/reviewService";

export const dynamic = "force-dynamic";
const send = (r: { ok: boolean; status: number; data?: unknown; body?: unknown }) => NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

async function guard(req: NextRequest) {
  const auth = await requireApiPermission("judges:manage");
  if ("error" in auth) return { error: auth.error };
  if (!sameOrigin(req)) return { error: NextResponse.json({ message: "This request was not allowed." }, { status: 403 }) };
  return { user: auth.user };
}

/** { mode: "auto", role, perApplication, statuses, valueChains?, states?, dryRun } or { mode: "one", applicationId, panelEmail } */
export async function POST(req: NextRequest) {
  const g = await guard(req); if ("error" in g) return g.error;
  try {
    const body = ((await readJson(req, 5_000)) ?? {}) as Record<string, unknown>;
    return send(body.mode === "one" ? await assignOne(body, g.user.email) : await autoAssign(body, g.user.email));
  } catch (e) { return serverError(e); }
}

/** { reviewId, action: "withdraw" | "reopen" } */
export async function PATCH(req: NextRequest) {
  const g = await guard(req); if ("error" in g) return g.error;
  try { return send(await changeReview(await readJson(req, 1_000), g.user.email)); } catch (e) { return serverError(e); }
}
