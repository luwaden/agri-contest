import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Files kept on the server's own disk (FILE_STORE_DIR, default `.data/files`, git-ignored).
 *
 * Used for: email attachments (always), and Level 2 uploads when Cloudinary is not set up.
 * A stored file is referred to as `stored:<folder>/<file>`; staff open it through /api/admin/files.
 *
 * The disk must survive restarts and redeploys (true for `npm start` on your own PC or a VPS; NOT true on
 * hosts with a throw-away disk, where Cloudinary should be used instead).
 */
export const STORED_PREFIX = "stored:";
const KEY_RE = /^[a-z0-9-]+(?:\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_-]+(?:\.[a-z0-9]{1,5})?$/;
const root = () => path.resolve(process.env.FILE_STORE_DIR || path.join(".data", "files"));

export const isStoredRef = (s: unknown): s is string => typeof s === "string" && s.startsWith(STORED_PREFIX) && KEY_RE.test(s.slice(STORED_PREFIX.length)) && !s.includes("..");

/** Absolute path for a key, refusing anything that would leave the store folder. */
function resolveKey(key: string): string {
  if (!KEY_RE.test(key) || key.includes("..")) throw new Error("BAD_FILE_KEY");
  const full = path.resolve(root(), key);
  if (!full.startsWith(root() + path.sep)) throw new Error("BAD_FILE_KEY");
  return full;
}

export async function saveLocal(key: string, data: Uint8Array): Promise<string> {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { flag: "wx" });   // never overwrite
  return STORED_PREFIX + key;
}

/** The file's bytes, or null if it is not there (deleted, or a different server). */
export async function readLocal(ref: string): Promise<Buffer | null> {
  if (!isStoredRef(ref)) return null;
  try { return await readFile(resolveKey(ref.slice(STORED_PREFIX.length))); } catch { return null; }
}

export async function writeLocalJson(key: string, value: unknown) {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, JSON.stringify(value));
}
export async function readLocalJson<T>(key: string): Promise<T | null> {
  try { return JSON.parse(await readFile(resolveKey(key), "utf8")) as T; } catch { return null; }
}
