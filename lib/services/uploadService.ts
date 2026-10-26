import { checkFile } from "@/lib/cloudinary/validate";
import { cloudinaryConfigured, newPublicId, uploadBuffer } from "@/lib/cloudinary/client";
import { DOC_STAGE, uploadFolder, type UploadScope } from "@/lib/cloudinary/folders";
import { DOCUMENT_KINDS } from "@/config/programme";
import { L2_DOC_KINDS } from "@/config/level2";
import type { ServiceResult } from "./applicationService";
import { saveLocal } from "@/lib/files/localStore";

/**
 * Where Level 2 files go. UPLOAD_STORAGE=cloudinary | local; unset = Cloudinary when it is set up, otherwise this
 * server's disk (.data/files/level-2/<code>/). Other uploads always need Cloudinary.
 */
export const level2Storage = (): "cloudinary" | "local" =>
  process.env.UPLOAD_STORAGE === "local" ? "local" : process.env.UPLOAD_STORAGE === "cloudinary" || cloudinaryConfigured() ? "cloudinary" : "local";

export interface UploadInput { buffer: Uint8Array; filename: string; scope: UploadScope; ownerId: string; kind: string }
export interface UploadOutput { url: string; publicId: string; bytes: number; folder: string; kind: string }

/** Validates, then stores in the right Cloudinary folder. Never trusts the browser's MIME type or file name. */
export async function storeUpload(i: UploadInput): Promise<ServiceResult<UploadOutput>> {
  if (i.scope === "level2" && level2Storage() === "local") return storeLocally(i);
  if (!cloudinaryConfigured()) return { ok: false, status: 503, body: { message: "File upload is not available right now. You can paste a link to your file instead." } };
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
    console.error("[upload]", (e as Error).message);
    return { ok: false, status: 502, body: { message: "The upload did not go through. Please try again, or paste a link to your file instead." } };
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
    console.error("[upload] local store:", (e as Error).message);
    return { ok: false, status: 502, body: { message: "The upload did not go through. Please try again, or paste a link to your file instead." } };
  }
}
