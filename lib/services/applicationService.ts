import { getRepository } from "@/lib/repository";
import { validateAll } from "@/lib/validation/application";
import { toApplication } from "@/lib/mapper";
import { generateReference } from "@/lib/reference";
import { getWindowStatus, windowSummary } from "@/lib/window";
import { hashToken } from "@/lib/draft";
import { mirrorToGoogleScript } from "@/lib/integrations/googleScript";
import { cloudinaryConfigured, parseCloudinaryUrl, tagFiles } from "@/lib/cloudinary/client";

/** Framework-free: takes plain data, returns a plain result. Next.js route handlers (and later Express) just translate it to HTTP. */
export type ServiceResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; body: Record<string, unknown> };

export async function submitApplication(input: { values: Record<string, unknown>; draftToken?: string }): Promise<ServiceResult<{ applicationId: string; submittedAt: string | null }>> {
  // The deadline is enforced HERE, independent of the UI.
  const status = getWindowStatus();
  if (status !== "OPEN") {
    const w = windowSummary();
    return { ok: false, status: 403, body: { code: `WINDOW_${status}`, message: status === "CLOSED" ? "Applications are now closed." : `Applications are not open yet. They open on ${w.openLabel}.` } };
  }
  const result = validateAll({ ...input.values });
  if (!result.ok) return { ok: false, status: 422, body: { message: "Please fix the highlighted fields and try again.", errors: result.errors, declarationError: result.declarationError } };

  const repo = getRepository();
  const email = String(result.data.email);
  const existing = (await repo.getApplications()).find((a) => a.applicant.email === email && a.submissionStatus !== "DRAFT");
  if (existing) return { ok: false, status: 409, body: { code: "DUPLICATE_EMAIL", message: "An application has already been submitted with this email address. If you think this is a mistake, please contact the programme team." } };

  let applicationId = ""; let application;
  for (let attempt = 0; attempt < 5; attempt++) {
    applicationId = generateReference(new Date().getFullYear());
    application = toApplication(result.data, { applicationId, status: "SUBMITTED", now: new Date() });
    try { await repo.createApplication(application); break; }
    catch (e) { if ((e as Error).message !== "DUPLICATE_ID" || attempt === 4) throw e; }
  }
  await repo.logEvent({ at: new Date().toISOString(), applicationId, actor: "applicant", action: "SUBMITTED", detail: application!.location.state });
  if (input.draftToken) await repo.deleteDraft(hashToken(input.draftToken)).catch(() => undefined);

  // Best-effort extras: never block or fail the submission.
  if (cloudinaryConfigured()) {
    const files = application!.documents.map((d) => parseCloudinaryUrl(d.url)).filter((p): p is NonNullable<typeof p> => !!p);
    if (files.length) void tagFiles(files, `app_${applicationId}`).catch((e) => console.error("[cloudinary] tagging failed:", (e as Error).message));
  }
  void mirrorToGoogleScript("application", { applicationId, submittedAt: application!.submittedAt, state: application!.location.state, applicant: application!.applicant, business: application!.business.businessName });
  return { ok: true, status: 201, data: { applicationId, submittedAt: application!.submittedAt } };
}
