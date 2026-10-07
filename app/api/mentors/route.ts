import { NextResponse, type NextRequest } from "next/server";
import { badRequest, clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { generateReference, MENTOR_PREFIX } from "@/lib/reference";
import { submitMentor } from "@/lib/services/mentorService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
    const rl = rateLimit(`mentor:${clientIp(req)}`, 5, 15 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const body = (await readJson(req, 40_000)) as { values?: Record<string, unknown>; companyWebsite?: string } | null;
    if (!body?.values || typeof body.values !== "object") return badRequest("We could not read your application. Please try again.");
    if (body.companyWebsite) return NextResponse.json({ mentorId: generateReference(new Date().getFullYear(), MENTOR_PREFIX) }, { status: 201 });
    const r = await submitMentor(body.values);
    return r.ok ? NextResponse.json(r.data, { status: r.status }) : NextResponse.json(r.body, { status: r.status });
  } catch (e) { return serverError(e); }
}
