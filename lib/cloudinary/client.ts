import { createHash, randomBytes } from "node:crypto";

const base = () => process.env.CLOUDINARY_API_BASE || "https://api.cloudinary.com";
const cloud = () => process.env.CLOUDINARY_CLOUD_NAME || "";
export const cloudinaryConfigured = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
/** "authenticated" (default) = files are private and only reachable through signed links; "upload" = public URLs. */
export const deliveryType = () => (process.env.CLOUDINARY_DELIVERY === "upload" ? "upload" : "authenticated");

/** Cloudinary signature: sha1 of alphabetically sorted `key=value` pairs joined by & plus the API secret. */
export function sign(params: Record<string, string | number | undefined>, secret = process.env.CLOUDINARY_API_SECRET || ""): string {
  const str = Object.keys(params).filter((k) => params[k] !== undefined && params[k] !== "").sort().map((k) => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(str + secret).digest("hex");
}

export interface UploadResult { publicId: string; url: string; resourceType: string; type: string; format?: string; bytes: number; version: number }

export async function uploadBuffer(o: { buffer: Uint8Array; filename: string; mime: string; folder: string; publicId: string; tags: string[]; context: Record<string, string> }): Promise<UploadResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const type = deliveryType();
  const context = Object.entries(o.context).map(([k, v]) => `${k}=${v.replace(/[|=]/g, " ")}`).join("|");
  const signed = { context, folder: o.folder, overwrite: "false", public_id: o.publicId, tags: o.tags.join(","), timestamp, type };
  const form = new FormData();
  form.set("file", new Blob([o.buffer as BlobPart], { type: o.mime }), o.filename);
  for (const [k, v] of Object.entries(signed)) form.set(k, String(v));
  form.set("api_key", process.env.CLOUDINARY_API_KEY!);
  form.set("signature", sign(signed));
  const res = await fetch(`${base()}/v1_1/${cloud()}/auto/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(45_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.public_id || !body.secure_url) throw new Error(`Cloudinary upload failed (${res.status}): ${body?.error?.message ?? "no detail"}`);
  return { publicId: body.public_id, url: body.secure_url, resourceType: body.resource_type, type: body.type, format: body.format, bytes: body.bytes, version: body.version };
}

export const newPublicId = (kind: string) => `${kind.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;

/** Parses a Cloudinary delivery URL back into its parts (so no extra column is needed in the database). */
export function parseCloudinaryUrl(url: string) {
  const m = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/(image|raw|video)\/(upload|authenticated|private)\/(?:s--[^/]+--\/)?(?:v(\d+)\/)?(.+)$/.exec(url);
  if (!m) return null;
  const [, cloudName, resourceType, type, version, rest] = m;
  const dot = rest.lastIndexOf(".");
  const hasExt = dot > rest.lastIndexOf("/") && rest.length - dot <= 6;
  // Raw resources keep their extension inside the public id; images carry it as the format.
  const publicId = resourceType === "raw" || !hasExt ? rest : rest.slice(0, dot);
  return { cloudName, resourceType, type, version, publicId, format: resourceType === "raw" || !hasExt ? undefined : rest.slice(dot + 1) };
}

/** Time-limited download link for private files. Used only by authorised staff via /api/admin/files. */
export function signedDownloadUrl(p: { publicId: string; resourceType: string; type: string; format?: string }, ttlSeconds = 300): string {
  const params = { attachment: "false", expires_at: Math.floor(Date.now() / 1000) + ttlSeconds, format: p.format, public_id: p.publicId, timestamp: Math.floor(Date.now() / 1000), type: p.type };
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, api_key: process.env.CLOUDINARY_API_KEY!, signature: sign(params) })) if (v !== undefined && v !== "") q.set(k, String(v));
  return `${base()}/v1_1/${cloud()}/${p.resourceType}/download?${q}`;
}

/** Best effort: label uploaded files with the application reference so they can be found from either side. */
export async function tagFiles(files: Array<{ publicId: string; resourceType: string; type: string }>, tag: string): Promise<void> {
  const groups = new Map<string, string[]>();
  for (const f of files) { const k = `${f.resourceType}|${f.type}`; groups.set(k, [...(groups.get(k) ?? []), f.publicId]); }
  for (const [k, ids] of groups) {
    const [resourceType, type] = k.split("|");
    const params = { command: "add", public_ids: ids.join(","), tag, timestamp: Math.floor(Date.now() / 1000), type };
    const form = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([a, b]) => [a, String(b)])), api_key: process.env.CLOUDINARY_API_KEY!, signature: sign(params) });
    await fetch(`${base()}/v1_1/${cloud()}/${resourceType}/tags`, { method: "POST", body: form, signal: AbortSignal.timeout(15_000) });
  }
}
