import { getRepository } from "@/lib/repository";
import { validateMentor } from "@/lib/validation/mentor";
import { generateReference, MENTOR_PREFIX } from "@/lib/reference";
import { mirrorToGoogleScript } from "@/lib/integrations/googleScript";
import { cloudinaryConfigured, parseCloudinaryUrl, tagFiles } from "@/lib/cloudinary/client";
import type { MentorApplication, MentorStatus } from "@/types/mentor";
import type { ServiceResult } from "./applicationService";

export async function submitMentor(values: Record<string, unknown>): Promise<ServiceResult<{ mentorId: string }>> {
  const r = validateMentor(values);
  if (!r.ok) return { ok: false, status: 422, body: { message: "Please fix the highlighted fields and try again.", errors: r.errors } };
  const repo = getRepository(); const d = r.data;
  const duplicate = (await repo.getMentors()).find((m) => m.email === d.email && m.status !== "DECLINED");
  if (duplicate) return { ok: false, status: 409, body: { code: "DUPLICATE_EMAIL", message: "We already have a mentor application from this email address. If you need to update it, please contact the programme team." } };

  const now = new Date().toISOString();
  let mentor!: MentorApplication;
  for (let i = 0; i < 5; i++) {
    mentor = {
      mentorId: generateReference(new Date().getFullYear(), MENTOR_PREFIX), status: "NEW", submittedAt: now, updatedAt: now,
      fullName: d.fullName, email: d.email, phone: d.phone, state: d.state, location: d.location, profession: d.profession, organization: d.organization,
      industry: d.industry, yearsExperience: Number(d.yearsExperience), mentorshipExperience: d.mentorshipExperience, expertise: d.expertise,
      availability: d.availability, availabilityNotes: d.availabilityNotes, linkedin: d.linkedin, portfolio: d.portfolio, motivation: d.motivation,
      documents: d.docCv ? [{ kind: "CV", url: d.docCv }] : [], consent: true, source: "web",
    };
    try { await repo.createMentor(mentor); break; } catch (e) { if ((e as Error).message !== "DUPLICATE_ID" || i === 4) throw e; }
  }
  await repo.logEvent({ at: now, applicationId: mentor.mentorId, actor: "mentor-applicant", action: "MENTOR_SUBMITTED", detail: mentor.state });
  if (cloudinaryConfigured()) {
    const files = mentor.documents.map((x) => parseCloudinaryUrl(x.url)).filter((p): p is NonNullable<typeof p> => !!p);
    if (files.length) void tagFiles(files, `mentor_${mentor.mentorId}`).catch(() => undefined);
  }
  void mirrorToGoogleScript("mentor", { mentorId: mentor.mentorId, submittedAt: now, fullName: mentor.fullName, email: mentor.email, expertise: mentor.expertise });
  return { ok: true, status: 201, data: { mentorId: mentor.mentorId } };
}

export const listMentors = () => getRepository().getMentors();
export const getMentor = (id: string) => getRepository().getMentorById(id);
export const setMentorStatus = (id: string, s: MentorStatus, actor: string) => getRepository().updateMentorStatus(id, s, actor);
