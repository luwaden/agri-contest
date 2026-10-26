import "server-only";
import { after } from "next/server";
import { getRepository } from "@/lib/repository";
import { emailProvider, sendEmail, type EmailMessage } from "./send";
import { applicantConfirmation, teamMessage } from "./templates";
import { PROGRAMME } from "@/config/programme";
import { featureOn } from "@/lib/features";

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
  // Admin → Settings → "Automatic confirmation emails". Checked when sending, never before the submission is saved.
  if (!(await featureOn("confirmationEmails").catch(() => true))) { console.log(`[email] ${kind} for ${ref} not sent: confirmation emails are switched off`); return; }
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

/** Level 2: one short confirmation to the address given on the form. */
export function emailLevel2Received(a: { level1Code: string; email: string; contactName: string; businessName: string }) {
  if (emailProvider() === "off") return;
  const first = a.contactName.split(" ")[0] || "applicant";
  const msg = teamMessage({ to: a.email, subject: `Level 2 application received: ${a.level1Code}`, heading: "We have received your Level 2 application", ref: a.level1Code, key: `level2-${a.level1Code}`,
    body: `Dear ${first},\n\nThank you. We have received the Level 2 application for ${a.businessName}.\n\nThe programme team will review it and contact you about the next step. Please keep your Level 1 application code for any communication.\n\nThe ${PROGRAMME.shortName} team` });
  inBackground(() => deliver("level 2 confirmation", a.level1Code, msg));
}
