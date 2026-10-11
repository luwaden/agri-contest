import "server-only";
import { after } from "next/server";
import { getRepository } from "@/lib/repository";
import { emailProvider, sendEmail, type EmailMessage } from "./send";
import { applicantConfirmation } from "./templates";

/**
 * Only APPLICANTS get an email (one confirmation each). Panel applications and team notices send nothing.
 * Emails are sent AFTER the applicant has their reference number on screen: the submission never waits for, or fails
 * because of, an email. On Vercel, after() keeps the function alive until the email has gone.
 * Failures are written to the "Application Events" tab as EMAIL_FAILED (successes are not, to save sheet writes).
 */
function inBackground(task: () => Promise<void>) {
  const run = () => task().catch((e) => console.error("[email] unexpected:", (e as Error).message));
  try { after(run); } catch { void run(); }   // outside a request (scripts, tests): just run it
}

async function deliver(kind: string, ref: string, msg: EmailMessage) {
  const r = await sendEmail(msg);
  if (r.ok) { console.log(`[email] ${kind} for ${ref} sent via ${r.provider}`); return; }
  if (r.reason === "EMAIL_OFF") return;
  console.error(`[email] ${kind} for ${ref} FAILED via ${r.provider}: ${r.reason}`);
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: ref, actor: "system", action: "EMAIL_FAILED", detail: `${kind}: ${r.reason}`.slice(0, 300) }).catch(() => undefined);
}

export function emailApplicant(a: Parameters<typeof applicantConfirmation>[0]) {
  if (emailProvider() === "off") return;
  inBackground(() => deliver("applicant confirmation", a.applicationId, applicantConfirmation(a)));
}
