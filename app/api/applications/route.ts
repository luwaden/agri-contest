import { NextResponse, type NextRequest } from "next/server";
import { getRepository } from "@/lib/repository";
import { validateAll } from "@/lib/validation/application";
import { toApplication } from "@/lib/mapper";
import { generateReference } from "@/lib/reference";
import { getWindowStatus, windowSummary } from "@/lib/window";
import { badRequest, clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { hashToken } from "@/lib/draft";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. The deadline is enforced HERE, independent of the UI.
    const status = getWindowStatus();
    if (status !== "OPEN") {
      const w = windowSummary();
      return NextResponse.json({ code: `WINDOW_${status}`, message: status === "CLOSED" ? "Applications are now closed." : `Applications are not open yet. They open on ${w.openLabel}.` }, { status: 403 });
    }
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });

    // 2. Abuse controls
    const rl = rateLimit(`submit:${clientIp(req)}`, 8, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);

    const body = (await readJson(req, 100_000)) as { values?: Record<string, unknown>; draftToken?: string; companyWebsite?: string } | null;
    if (!body || typeof body !== "object" || !body.values) return badRequest("We could not read your application. Please try again.");
    // Honeypot: real users never fill this hidden field. Pretend success to bots.
    if (body.companyWebsite) return NextResponse.json({ applicationId: generateReference() }, { status: 201 });

    // 3. Server-side validation (never trust the client's checks)
    const result = validateAll({ ...body.values });
    if (!result.ok) {
      return NextResponse.json({ message: "Please fix the highlighted fields and try again.", errors: result.errors, declarationError: result.declarationError }, { status: 422 });
    }

    const repo = getRepository();

    // 4. One submission per email address
    const email = String(result.data.email);
    const existing = (await repo.getApplications()).find((a) => a.applicant.email === email && a.submissionStatus !== "DRAFT");
    if (existing) {
      return NextResponse.json({ code: "DUPLICATE_EMAIL", message: "An application has already been submitted with this email address. If you think this is a mistake, please contact the programme team." }, { status: 409 });
    }

    // 5. Non-sequential reference, uniqueness guaranteed by the repository
    let applicationId = "";
    let application;
    for (let attempt = 0; attempt < 5; attempt++) {
      applicationId = generateReference(new Date().getFullYear());
      application = toApplication(result.data, { applicationId, status: "SUBMITTED", now: new Date() });
      try { await repo.createApplication(application); break; }
      catch (e) { if ((e as Error).message !== "DUPLICATE_ID" || attempt === 4) throw e; }
    }

    await repo.logEvent({ at: new Date().toISOString(), applicationId, actor: "applicant", action: "SUBMITTED", detail: application!.location.state });
    if (body.draftToken) await repo.deleteDraft(hashToken(body.draftToken)).catch(() => undefined);

    return NextResponse.json({ applicationId, submittedAt: application!.submittedAt }, { status: 201 });
  } catch (e) { return serverError(e); }
}
