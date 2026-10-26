import "server-only";
import { randomBytes } from "node:crypto";
import { ALLOWED, sniff, type AllowedExt } from "@/lib/cloudinary/validate";
import { readLocal, readLocalJson, saveLocal, writeLocalJson } from "@/lib/files/localStore";

/**
 * Files attached to a message (Admin → Messages). Uploaded once, kept on the server's disk
 * (`.data/files/email-attachments/<id>/`), and attached to every email of the campaign when it is sent,
 * including batches sent on later days.
 */
export const ATTACHMENT_ID = /^ATT-[a-f0-9]{24}$/;
export const MAX_ATTACHMENTS = 5;
/** Total size of all files on one message. Gmail refuses emails over 25 MB; smaller files also land in Spam less often. */
export const attachmentLimitBytes = () => Math.max(1, Math.min(20, Number(process.env.EMAIL_ATTACHMENT_MAX_MB) || 10)) * 1024 * 1024;

export interface AttachmentInfo { id: string; name: string; bytes: number; mime: string }
export interface MailAttachment { filename: string; content: Buffer; contentType: string }

const TYPES: Record<string, { mime: string; sniffed: string }> = {
  ...Object.fromEntries((Object.keys(ALLOWED) as AllowedExt[]).map((e) => [e, { mime: ALLOWED[e].mime, sniffed: e === "docx" || e === "pptx" ? "zip" : e }])),
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sniffed: "zip" },
};
export const ATTACHMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx";

/** A name that is safe in an email header and on every operating system, keeping the extension. */
export function safeFileName(name: string, ext: string): string {
  const base = name.replace(/\.[^.]*$/, "").normalize("NFKC").replace(/[\u0000-\u001F\u007F"\\/:*?<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
  return `${base || "attachment"}.${ext}`;
}

export async function saveAttachment(buf: Uint8Array, filename: string): Promise<{ ok: true; data: AttachmentInfo } | { ok: false; message: string }> {
  if (!buf.length) return { ok: false, message: "That file is empty." };
  const limit = attachmentLimitBytes();
  if (buf.length > limit) return { ok: false, message: `That file is too large. Attachments can be up to ${Math.round(limit / 1048576)} MB in total.` };
  const ext = (filename.split(".").pop() || "").toLowerCase().replace("jpeg", "jpg");
  const t = TYPES[ext];
  if (!t) return { ok: false, message: "That file type cannot be attached. Use PDF, Word, PowerPoint, Excel (.xlsx) or an image (PNG, JPG, WebP)." };
  if (sniff(buf) !== t.sniffed) return { ok: false, message: "The file does not match its file type. Please attach the original file." };
  const id = `ATT-${randomBytes(12).toString("hex")}`;
  const info: AttachmentInfo = { id, name: safeFileName(filename, ext), bytes: buf.length, mime: t.mime };
  try {
    await saveLocal(`email-attachments/${id}/file.${ext}`, buf);
    await writeLocalJson(`email-attachments/${id}/meta.json`, info);
  } catch (e) {
    const m = `${(e as { code?: string }).code ?? ""} ${(e as Error).message}`;
    console.error("[attachments] could not store:", m);
    return { ok: false, message: /EROFS|EACCES|EPERM|read-only/i.test(m)
      ? "Attachments cannot be kept on this host (its disk is read-only, as on Vercel). Share the file as a link in the message instead."
      : "The file could not be saved on the server. Please try again." };
  }
  return { ok: true, data: info };
}

export async function attachmentsInfo(ids: string[]): Promise<{ list: AttachmentInfo[]; missing: string[] }> {
  const list: AttachmentInfo[] = [], missing: string[] = [];
  for (const id of ids) {
    const m = ATTACHMENT_ID.test(id) ? await readLocalJson<AttachmentInfo>(`email-attachments/${id}/meta.json`) : null;
    if (m) list.push(m); else missing.push(id);
  }
  return { list, missing };
}

/** The files, ready for the mail service. Anything missing is reported, never silently left out. */
export async function loadAttachments(ids: string[]): Promise<{ files: MailAttachment[]; missing: string[] }> {
  const { list, missing } = await attachmentsInfo(ids);
  const files: MailAttachment[] = [];
  for (const a of list) {
    const ext = a.name.split(".").pop()!;
    const content = await readLocal(`stored:email-attachments/${a.id}/file.${ext}`);
    if (content) files.push({ filename: a.name, content, contentType: a.mime }); else missing.push(a.id);
  }
  return { files, missing };
}
