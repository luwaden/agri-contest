import { randomBytes } from "node:crypto";
import { PROGRAMME } from "@/config/programme";

// No 0/O/1/I/L to avoid transcription errors when read over the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Random, non-sequential reference, e.g. AGRA-2026-K7QX4M. Uniqueness is enforced by the repository. */
export function generateReference(year = 2026): string {
  const bytes = randomBytes(6);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `${PROGRAMME.refPrefix}-${year}-${code}`;
}
export const REFERENCE_PATTERN = /^AGRA-\d{4}-[2-9A-HJKMNP-Z]{6}$/;
