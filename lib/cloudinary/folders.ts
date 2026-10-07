/**
 * Cloudinary folder layout (one place, so every upload is easy to trace):
 *
 *   programme/
 *     applicants/stage-1|2|3/<upload-session>/   files an applicant uploads at each stage
 *     mentors/<mentor-ref>/                       mentor CV / supporting documents
 *     programme-assets/                           site imagery managed by the team
 *     admin/                                      files uploaded by staff
 *
 * `<upload-session>` is a random id created in the applicant's browser. At submission the server tags every file
 * with the real application reference (tag `app_AGRA-2026-XXXXXX`), so a file can be found from the application
 * and the application from the file.
 */
const root = () => (process.env.CLOUDINARY_ROOT_FOLDER || "programme").replace(/[^a-zA-Z0-9_-]/g, "");

export const SESSION_PATTERN = /^[A-Za-z0-9_-]{12,40}$/;

export type UploadScope = "applicant" | "mentor";
export const APPLICANT_STAGES = [1, 2, 3] as const;

export function uploadFolder(scope: UploadScope, id: string, stage?: number): string {
  if (scope === "applicant") {
    if (!stage || !(APPLICANT_STAGES as readonly number[]).includes(stage)) throw new Error("Invalid stage");
    if (!SESSION_PATTERN.test(id)) throw new Error("Invalid upload session");
    return `${root()}/applicants/stage-${stage}/${id}`;
  }
  if (!/^MNTR-\d{4}-[A-Z0-9]{6}$/.test(id) && !SESSION_PATTERN.test(id)) throw new Error("Invalid mentor reference");
  return `${root()}/mentors/${id}`;
}
export const assetsFolder = () => `${root()}/programme-assets`;
export const adminFolder = () => `${root()}/admin`;

/** Which stage of the form each document belongs to. Stage 3 is where supporting material is collected today. */
export const DOC_STAGE: Record<string, number> = { PITCH_DECK: 3, BUSINESS_DOC: 3, REGISTRATION: 3, PRODUCT_IMAGES: 3, EVIDENCE: 3 };
