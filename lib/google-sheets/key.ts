import { createPrivateKey } from "node:crypto";

/**
 * Turns whatever was pasted into GOOGLE_PRIVATE_KEY into a valid PEM key.
 * Accepts: the key with \n sequences, with real line breaks, wrapped in quotes, with spaces instead of
 * line breaks, copied with the whole JSON file, or with Windows (CRLF) line endings.
 */
export function normalizePrivateKey(raw: string | undefined): string {
  let s = (raw ?? "").trim();
  // The whole service-account JSON was pasted instead of just the key
  if (s.startsWith("{")) { try { s = String(JSON.parse(s).private_key ?? s); } catch { /* fall through */ } }
  // Strip wrapping quotes (any number of layers)
  while (/^(["'`]).*\1$/s.test(s)) s = s.slice(1, -1).trim();
  // Literal "\n" (and double-escaped "\\n") -> real newline
  s = s.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n?/g, "\n");

  const m = /-----BEGIN ((?:RSA )?PRIVATE KEY)-----([\s\S]*?)-----END \1-----/.exec(s);
  if (!m) return s; // let validation explain what is wrong
  const body = m[2].replace(/\s+/g, "");
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN ${m[1]}-----\n${wrapped}\n-----END ${m[1]}-----\n`;
}

/** Returns null when the key is usable, otherwise a plain-English reason and fix. */
export function explainKeyProblem(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return "GOOGLE_PRIVATE_KEY is empty. Copy the \"private_key\" value from the downloaded JSON file.";
  const pem = normalizePrivateKey(raw);
  if (!pem.includes("-----BEGIN")) return "GOOGLE_PRIVATE_KEY does not start with -----BEGIN PRIVATE KEY-----. Copy the whole value of \"private_key\" from the JSON file, starting at the first dash. If you only see part of the key, the line was cut when it was pasted.";
  if (!pem.includes("-----END")) return "GOOGLE_PRIVATE_KEY is cut off: the -----END PRIVATE KEY----- line is missing. This happens when the key is pasted over several lines in a .env file. Put the whole key on ONE line, keeping the \\n characters exactly as they appear in the JSON file.";
  try { createPrivateKey(pem); return null; }
  catch {
    const bodyLen = pem.replace(/-----[^-]+-----|\s/g, "").length;
    return bodyLen < 1000
      ? `The key looks incomplete (${bodyLen} characters of key data; a real one has about 1,600). Copy it again from the JSON file, from the first dash to the last.`
      : "The key has the right shape but cannot be read: a character was changed or lost while copying. Copy it again directly from the JSON file (do not retype it, and do not let a chat app or Word reformat it).";
  }
}
