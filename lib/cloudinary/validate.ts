export const MAX_BYTES = () => Math.max(1, Number(process.env.UPLOAD_MAX_MB) || 8) * 1024 * 1024;

export const ALLOWED = {
  pdf: { mime: "application/pdf", label: "PDF" },
  png: { mime: "image/png", label: "PNG image" },
  jpg: { mime: "image/jpeg", label: "JPEG image" },
  webp: { mime: "image/webp", label: "WebP image" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word document" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PowerPoint" },
} as const;
export type AllowedExt = keyof typeof ALLOWED;
export const ACCEPT_ATTR = ".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx";

/** Identifies the real file type from its first bytes. A renamed .exe will not pass. */
export function sniff(buf: Uint8Array): "pdf" | "png" | "jpg" | "webp" | "zip" | null {
  const s = (i: number, ...b: number[]) => b.every((v, k) => buf[i + k] === v);
  if (buf.length < 12) return null;
  if (s(0, 0x25, 0x50, 0x44, 0x46)) return "pdf";
  if (s(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (s(0, 0xff, 0xd8, 0xff)) return "jpg";
  if (s(0, 0x52, 0x49, 0x46, 0x46) && s(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  if (s(0, 0x50, 0x4b, 0x03, 0x04)) return "zip";
  return null;
}

export type FileCheck = { ok: true; ext: AllowedExt; mime: string } | { ok: false; message: string };

export function checkFile(buf: Uint8Array, filename: string): FileCheck {
  if (buf.length === 0) return { ok: false, message: "That file is empty. Please choose another." };
  if (buf.length > MAX_BYTES()) return { ok: false, message: `That file is too large. The limit is ${Math.round(MAX_BYTES() / 1048576)} MB.` };
  const declared = (filename.split(".").pop() || "").toLowerCase().replace("jpeg", "jpg") as AllowedExt;
  if (!(declared in ALLOWED)) return { ok: false, message: "That file type is not allowed. Please upload a PDF, image (PNG, JPG, WebP), Word or PowerPoint file." };
  const real = sniff(buf);
  const okMatch = (declared === "docx" || declared === "pptx") ? real === "zip" : real === declared;
  if (!okMatch) return { ok: false, message: "The file does not match its file type. Please upload the original file." };
  return { ok: true, ext: declared, mime: ALLOWED[declared].mime };
}
