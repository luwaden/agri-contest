import { checkFile } from "@/lib/cloudinary/validate";
import { cloudinaryConfigured, newPublicId, uploadBuffer } from "@/lib/cloudinary/client";
import { DOC_STAGE, uploadFolder, type UploadScope } from "@/lib/cloudinary/folders";
import { DOCUMENT_KINDS } from "@/config/programme";
import { L2_DOC_KINDS } from "@/config/level2";
import type { ServiceResult } from "./applicationService";
import { saveLocal } from "@/lib/files/localStore";

/** Hosts whose disk is read-only or wiped between requests (Vercel, Netlify, AWS Lambda): files cannot be kept there. */
export const throwAwayDisk = () => Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

/**
 * Where Level 2 files go. UPLOAD_STORAGE=cloudinary | local; unset = Cloudinary when it is set up, otherwise this
 * server's disk (.data/files/level-2/<code>/) — except on Vercel-type hosts, where there is nowhere to keep them ("none").
 * Other uploads always need Cloudinary.
 */
export const level2Storage = (): "cloudinary" | "local" | "none" =>
  process.env.UPLOAD_STORAGE === "local" ? "local" : process.env.UPLOAD_STORAGE === "cloudinary" || cloudinaryConfigured() ? "cloudinary" : throwAwayDisk() ? "none" : "local";

const NOT_SET_UP = { message: "File upload is not set up on this website yet. Please paste a link to your file instead (for example a Google Drive link anyone can view).", code: "UPLOAD_NOT_CONFIGURED" };
/** A short code for each kind of storage failure, shown to the person and logged, so the cause can be found quickly. */
export function uploadFailureCode(e: unknown): string {
  const m = `${(e as { code?: string })?.code ?? ""} ${(e as Error)?.message ?? e}`;
  if (/EROFS|EACCES|EPERM|read-only/i.test(m)) return "DISK_READ_ONLY";
  if (/ENOSPC/i.test(m)) return "DISK_FULL";
  if (/Cloudinary upload failed \((401|403)\)|api_key|Invalid Signature|cloud_name/i.test(m)) return "CLOUDINARY_LOGIN";
  if (/Cloudinary upload failed \(400\)/i.test(m)) return "CLOUDINARY_REFUSED";
  if (/Cloudinary upload failed \(42|Rate Limit|quota/i.test(m)) return "CLOUDINARY_LIMIT";
  if (/timeout|abort|fetch failed|ENOTFOUND|ECONNRESET/i.test(m)) return "CLOUDINARY_UNREACHABLE";
  if (/Cloudinary/i.test(m)) return "CLOUDINARY_FAILED";
  return "STORE_FAILED";
}

export interface UploadInput { buffer: Uint8Array; filename: string; scope: UploadScope; ownerId: string; kind: string }
export interface UploadOutput { url: string; publicId: string; bytes: number; folder: string; kind: string }

/** Validates, then stores in the right Cloudinary folder. Never trusts the browser's MIME type or file name. */
export async function storeUpload(i: UploadInput): Promise<ServiceResult<UploadOutput>> {
  const where = i.scope === "level2" ? level2Storage() : "cloudinary";
  if (where === "local") return storeLocally(i);
  if (where === "none") { console.error("[upload] refused: no Cloudinary, and this host cannot keep files on its disk. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."); return { ok: false, status: 503, body: NOT_SET_UP }; }
  if (!cloudinaryConfigured()) return { ok: false, status: 503, body: { message: "File upload is not available right now. You can paste a link to your file instead.", code: "UPLOAD_NOT_CONFIGURED" } };
  const kinds = i.scope === "level2" ? [...L2_DOC_KINDS] as string[] : [...DOCUMENT_KINDS.map((d) => d.value as string), "CV"];
  if (!kinds.includes(i.kind)) return { ok: false, status: 400, body: { message: "That document type is not recognised." } };
  const check = checkFile(i.buffer, i.filename);
  if (!check.ok) return { ok: false, status: 422, body: { message: check.message } };
  let folder: string;
  try { folder = uploadFolder(i.scope, i.ownerId, i.scope === "applicant" ? DOC_STAGE[i.kind] ?? 3 : undefined); }
  catch { return { ok: false, status: 400, body: { message: "We could not start the upload. Please refresh the page and try again." } }; }
  try {
    const r = await uploadBuffer({
      buffer: i.buffer, filename: i.filename, mime: check.mime, folder, publicId: newPublicId(i.kind),
      tags: [i.scope, i.kind.toLowerCase()], context: { kind: i.kind, scope: i.scope },
    });
    return { ok: true, status: 201, data: { url: r.url, publicId: r.publicId, bytes: r.bytes, folder, kind: i.kind } };
  } catch (e) {
    const code = uploadFailureCode(e);
    console.error(`[upload] ${code}:`, (e as Error).message);
    return { ok: false, status: 502, body: { message: "The upload did not go through. Please try again, or paste a link to your file instead.", code } };
  }
}

async function storeLocally(i: UploadInput): Promise<ServiceResult<UploadOutput>> {
  if (!(L2_DOC_KINDS as readonly string[]).includes(i.kind)) return { ok: false, status: 400, body: { message: "That document type is not recognised." } };
  if (!/^AGRA-\d{4}-[A-Z0-9]{6}$/.test(i.ownerId)) return { ok: false, status: 400, body: { message: "We could not start the upload. Please refresh the page and try again." } };
  const check = checkFile(i.buffer, i.filename);
  if (!check.ok) return { ok: false, status: 422, body: { message: check.message } };
  const folder = `level-2/${i.ownerId}`;
  try {
    const url = await saveLocal(`${folder}/${newPublicId(i.kind)}.${check.ext}`, i.buffer);
    return { ok: true, status: 201, data: { url, publicId: url, bytes: i.buffer.length, folder, kind: i.kind } };
  } catch (e) {
    const code = uploadFailureCode(e);
    console.error(`[upload] local store ${code}:`, (e as Error).message, code === "DISK_READ_ONLY" ? "(this host cannot keep files: set up Cloudinary)" : "");
    if (code === "DISK_READ_ONLY") return { ok: false, status: 503, body: NOT_SET_UP };
    return { ok: false, status: 502, body: { message: "The upload did not go through. Please try again, or paste a link to your file instead.", code } };
  }
}
