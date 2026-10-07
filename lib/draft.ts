import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { stage1Schema, stage2Schema, stage3Schema } from "@/lib/validation/application";

export const newDraftToken = () => randomBytes(24).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

const KEYS = new Set<string>([
  ...Object.keys(stage1Schema.innerType().shape),
  ...Object.keys(stage2Schema.innerType().shape),
  ...Object.keys(stage3Schema.innerType().shape),
]);

/** Drafts are partial and unvalidated, so only whitelist known keys and cap sizes. */
export function sanitiseDraftValues(input: unknown): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!KEYS.has(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 1000);
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 120)).slice(0, 30);
  }
  return out;
}
