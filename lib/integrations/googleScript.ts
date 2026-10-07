/**
 * OPTIONAL mirror to a Google Apps Script web app. Off unless GOOGLE_SCRIPT_URL is set.
 * The primary store (Google Sheets via service account, or a future SQL database) is unaffected: if the script is
 * down or slow the applicant's submission still succeeds, and the failure is only logged.
 * Setup instructions and a sample doPost(e) are in docs/GOOGLE_SCRIPT.md.
 */
export async function mirrorToGoogleScript(kind: "application" | "mentor", payload: Record<string, unknown>): Promise<void> {
  const url = process.env.GOOGLE_SCRIPT_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST", redirect: "follow", signal: AbortSignal.timeout(8_000),
      headers: { "Content-Type": "text/plain;charset=utf-8" },     // text/plain avoids a CORS preflight on Apps Script
      body: JSON.stringify({ kind, secret: process.env.GOOGLE_SCRIPT_SECRET ?? "", receivedAt: new Date().toISOString(), data: payload }),
    });
    if (!res.ok) console.error(`[googleScript] ${kind} mirror returned HTTP ${res.status}`);
  } catch (e) { console.error(`[googleScript] ${kind} mirror failed:`, (e as Error).message); }
}
