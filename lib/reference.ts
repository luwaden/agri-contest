import { randomBytes } from "node:crypto";
import { PROGRAMME } from "@/config/programme";

// No 0/O/1/I/L to avoid transcription errors when read over the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Random, non-sequential reference, e.g. AGRA-2026-K7QX4M. Uniqueness is enforced by the repository. */
export function generateReference(year = 2026, prefix: string = PROGRAMME.refPrefix): string {
  const bytes = randomBytes(6);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `${prefix}-${year}-${code}`;
}
export const REFERENCE_PATTERN = /^AGRA-\d{4}-[2-9A-HJKMNP-Z]{6}$/;

export const MENTOR_PREFIX = "MNTR";
export const MENTOR_REFERENCE_PATTERN = /^MNTR-\d{4}-[2-9A-HJKMNP-Z]{6}$/;
