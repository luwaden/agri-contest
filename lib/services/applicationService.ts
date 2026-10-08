import { getRepository } from "@/lib/repository";
import { validateAll } from "@/lib/validation/application";
import { toApplication } from "@/lib/mapper";
import { generateReference } from "@/lib/reference";
import { getWindowStatus, windowSummary } from "@/lib/window";
import { hashToken } from "@/lib/draft";
import { deleteDraft } from "@/lib/services/draftService";
import { kv, redisConfigured } from "@/lib/kv";
import { createHash } from "node:crypto";
import { mirrorToGoogleScript } from "@/lib/integrations/googleScript";
import { cloudinaryConfigured, parseCloudinaryUrl, tagFiles } from "@/lib/cloudinary/client";

/** Framework-free: takes plain data, returns a plain result. Next.js route handlers (and later Express) just translate it to HTTP. */
export type ServiceResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; body: Record<string, unknown> };

const EMAILS = "applicants:emails", SEEDED = "applicants:emails:seeded";
const emailHash = (e: string) => createHash("sha256").update(e.trim().toLowerCase()).digest("hex").slice(0, 32);
type Repo = ReturnType<typeof getRepository>;

/**
 * One application per e-mail address. With Redis this is a single atomic SADD (no sheet read, and two people clicking
 * Submit at the same instant cannot both win). The index is seeded once from the existing rows. Without Redis it
 * reads the sheet, as before.
 */
async function claimEmail(repo: Repo, email: string): Promise<{ ok: boolean; release: () => Promise<void> }> {
  const sheetCheck = async () => !(await repo.getApplications()).some((a) => a.applicant.email === email && a.submissionStatus !== "DRAFT");
  if (!redisConfigured()) return { ok: await sheetCheck(), release: async () => {} };

  // Seed the index from existing rows exactly once. Everyone else waits briefly for that to finish.
  if (!(await kv.get(SEEDED))) {
    if (await kv.set(`${SEEDED}:lock`, "1", { nx: true, ex: 60 })) {
      const existing = (await repo.getApplications()).filter((a) => a.submissionStatus !== "DRAFT").map((a) => emailHash(a.applicant.email));
      if (existing.length) await kv.saddMany(EMAILS, existing);
      await kv.set(SEEDED, "1");
    } else {
      for (let i = 0; i < 10 && !(await kv.get(SEEDED)); i++) await new Promise((r) => setTimeout(r, 250));
    }
  }

  // The atomic claim: exactly one caller can add a given address, even if both click Submit at the same instant.
  const h = emailHash(email);
  const fresh = await kv.sadd(EMAILS, h);
  if (!fresh) return { ok: false, release: async () => {} };
  // If the index was still incomplete (seeding slow or Redis was down), double-check against the sheet.
  if (!(await kv.get(SEEDED)) && !(await sheetCheck())) { await kv.srem(EMAILS, h); return { ok: false, release: async () => {} }; }
  return { ok: true, release: async () => { await kv.srem(EMAILS, h); } };
}

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
  const claim = await claimEmail(repo, email);
  if (!claim.ok) return { ok: false, status: 409, body: { code: "DUPLICATE_EMAIL", message: "An application has already been submitted with this email address. If you think this is a mistake, please contact the programme team." } };

  let applicationId = ""; let application;
  for (let attempt = 0; attempt < 5; attempt++) {
    applicationId = generateReference(new Date().getFullYear());
    application = toApplication(result.data, { applicationId, status: "SUBMITTED", now: new Date() });
    try { await repo.createApplication(application); break; }
    catch (e) { if ((e as Error).message !== "DUPLICATE_ID" || attempt === 4) { await claim.release(); throw e; } }
  }
  await repo.logEvent({ at: new Date().toISOString(), applicationId, actor: "applicant", action: "SUBMITTED", detail: application!.location.state });
  if (input.draftToken) await deleteDraft(hashToken(input.draftToken)).catch(() => undefined);

  // Best-effort extras: never block or fail the submission.
  if (cloudinaryConfigured()) {
    const files = application!.documents.map((d) => parseCloudinaryUrl(d.url)).filter((p): p is NonNullable<typeof p> => !!p);
    if (files.length) void tagFiles(files, `app_${applicationId}`).catch((e) => console.error("[cloudinary] tagging failed:", (e as Error).message));
  }
  void mirrorToGoogleScript("application", { applicationId, submittedAt: application!.submittedAt, state: application!.location.state, applicant: application!.applicant, business: application!.business.businessName });
  return { ok: true, status: 201, data: { applicationId, submittedAt: application!.submittedAt } };
}
