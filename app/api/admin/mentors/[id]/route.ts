import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { badRequest, readJson, sameOrigin, serverError } from "@/lib/http";
import { MENTOR_REFERENCE_PATTERN } from "@/lib/reference";
import { MENTOR_STATUSES } from "@/config/mentors";
import { setMentorStatus } from "@/lib/services/mentorService";
import type { MentorStatus } from "@/types/mentor";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("mentors:review");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const { id } = await ctx.params;
    if (!MENTOR_REFERENCE_PATTERN.test(id)) return badRequest("That mentor reference is not valid.");
    const body = (await readJson(req, 1_000)) as { status?: string } | null;
    if (!body?.status || !MENTOR_STATUSES.some((s) => s.value === body.status)) return badRequest("Please choose a valid status.");
    const m = await setMentorStatus(id, body.status as MentorStatus, auth.user.email);
    return m ? NextResponse.json({ status: m.status }) : NextResponse.json({ message: "We could not find that mentor application." }, { status: 404 });
  } catch (e) { return serverError(e); }
}
