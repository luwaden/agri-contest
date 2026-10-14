import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { REFERENCE_PATTERN } from "@/lib/reference";
import { declareConflict, saveScoreSheet } from "@/lib/services/reviewService";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function guard(req: NextRequest, ctx: Ctx) {
  const auth = await requireApiPermission("scores:submit");
  if ("error" in auth) return { error: auth.error };
  if (!sameOrigin(req)) return { error: NextResponse.json({ message: "This request was not allowed." }, { status: 403 }) };
  const { id } = await ctx.params;
  if (!REFERENCE_PATTERN.test(id)) return { error: NextResponse.json({ message: "This application is not assigned to you." }, { status: 404 }) };
  return { user: auth.user, id };
}
const send = (r: { ok: boolean; status: number; data?: unknown; body?: unknown }) => NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

/** Save the score sheet (draft), or submit it with { submit: true }. Only the person it is assigned to. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const g = await guard(req, ctx); if ("error" in g) return g.error;
  try { return send(await saveScoreSheet(g.user, g.id, ((await readJson(req, 20_000)) ?? {}) as Record<string, unknown>)); } catch (e) { return serverError(e); }
}

/** Declare a conflict of interest: the entry is never scored by this person and the programme team reassigns it. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await guard(req, ctx); if ("error" in g) return g.error;
  try { return send(await declareConflict(g.user, g.id, ((await readJson(req, 2_000)) ?? {}) as Record<string, unknown>)); } catch (e) { return serverError(e); }
}
