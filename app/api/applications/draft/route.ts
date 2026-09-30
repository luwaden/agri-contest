import { NextResponse, type NextRequest } from "next/server";
import { getRepository } from "@/lib/repository";
import { getWindowStatus } from "@/lib/window";
import { badRequest, clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { hashToken, newDraftToken, sanitiseDraftValues } from "@/lib/draft";

export const dynamic = "force-dynamic";

/** Save progress. The random token (kept in the applicant's browser and resume link) is the only key; only its hash is stored. */
export async function POST(req: NextRequest) {
  try {
    if (getWindowStatus() !== "OPEN") return NextResponse.json({ message: "Applications are not open, so progress cannot be saved." }, { status: 403 });
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
    const rl = rateLimit(`draft:${clientIp(req)}`, 60, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);

    const body = (await readJson(req)) as { token?: string; values?: unknown; stage?: number } | null;
    if (!body) return badRequest("We could not save your progress. Please try again.");
    const values = sanitiseDraftValues(body.values);
    const token = typeof body.token === "string" && body.token.length >= 20 && body.token.length <= 64 ? body.token : newDraftToken();
    await getRepository().saveDraft({
      tokenHash: hashToken(token), email: String(values.email ?? ""), updatedAt: new Date().toISOString(),
      stage: Math.min(2, Math.max(0, Number(body.stage) || 0)), values,
    });
    return NextResponse.json({ token, savedAt: new Date().toISOString() });
  } catch (e) { return serverError(e); }
}

export async function GET(req: NextRequest) {
  try {
    const rl = rateLimit(`draft-get:${clientIp(req)}`, 30, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const token = req.nextUrl.searchParams.get("token") ?? "";
    if (token.length < 20 || token.length > 64) return NextResponse.json({ message: "We could not find that saved application." }, { status: 404 });
    const d = await getRepository().getDraft(hashToken(token));
    if (!d) return NextResponse.json({ message: "We could not find that saved application. It may already have been submitted." }, { status: 404 });
    return NextResponse.json({ values: d.values, stage: d.stage, savedAt: d.updatedAt });
  } catch (e) { return serverError(e); }
}
