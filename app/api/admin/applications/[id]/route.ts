import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { getRepository } from "@/lib/repository";
import { ACTIVE_STATUS_TRANSITIONS } from "@/config/programme";
import { badRequest, readJson, sameOrigin, serverError } from "@/lib/http";
import { REFERENCE_PATTERN } from "@/lib/reference";
import { isDemoMode } from "@/lib/data";
import type { ApplicationStatus } from "@/types/application";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("applications:status");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const { id } = await ctx.params;
    if (!REFERENCE_PATTERN.test(id)) return badRequest("That application reference is not valid.");
    if (isDemoMode()) return badRequest("Demo data cannot be edited.");
    const body = (await readJson(req, 1_000)) as { status?: string } | null;
    if (!body?.status || !ACTIVE_STATUS_TRANSITIONS.includes(body.status)) return badRequest("Please choose a valid status.");
    const updated = await getRepository().updateStatus(id, body.status as ApplicationStatus, auth.user.email);
    if (!updated) return NextResponse.json({ message: "We could not find that application." }, { status: 404 });
    return NextResponse.json({ status: updated.submissionStatus });
  } catch (e) { return serverError(e); }
}
