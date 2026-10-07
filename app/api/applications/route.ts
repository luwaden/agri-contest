import { NextResponse, type NextRequest } from "next/server";
import { badRequest, clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { generateReference } from "@/lib/reference";
import { submitApplication } from "@/lib/services/applicationService";

export const dynamic = "force-dynamic";

/** Thin HTTP adapter: abuse controls here, all business rules in the service. */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
    const rl = rateLimit(`submit:${clientIp(req)}`, 8, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const body = (await readJson(req, 100_000)) as { values?: Record<string, unknown>; draftToken?: string; companyWebsite?: string } | null;
    if (!body || typeof body !== "object" || !body.values) return badRequest("We could not read your application. Please try again.");
    // Honeypot: real users never fill this hidden field. Pretend success to bots.
    if (body.companyWebsite) return NextResponse.json({ applicationId: generateReference() }, { status: 201 });
    const r = await submitApplication({ values: body.values, draftToken: typeof body.draftToken === "string" ? body.draftToken : undefined });
    return r.ok ? NextResponse.json(r.data, { status: r.status }) : NextResponse.json(r.body, { status: r.status });
  } catch (e) { return serverError(e); }
}
