/**
 * Sends ONE sample confirmation email, exactly as an applicant would receive it, using the settings in .env.
 *   npm run email:test -- you@example.org
 * Nothing is written to the sheet.
 */
import "./loadEnv";   // loads .env / .env.local exactly like Next.js. Must stay FIRST
import { emailProvider, emailSetupProblem, sendEmail } from "../lib/email/send";
import { applicantConfirmation } from "../lib/email/templates";

const to = process.argv.slice(2).find((a) => a.includes("@"));
if (!to) { console.error('\nUsage: npm run email:test -- you@example.org\n'); process.exit(1); }
const problem = emailSetupProblem();
if (problem) { console.error(`\n✘ ${problem}\n  See docs/EMAIL.md.\n`); process.exit(1); }
const provider = emailProvider();
if (provider === "off") { console.error("\n✘ Email is off. Add GMAIL_USER and GMAIL_APP_PASSWORD (or RESEND_API_KEY and EMAIL_FROM) to .env. See docs/EMAIL.md.\n"); process.exit(1); }

(async () => {
  console.log(`\nSending a sample confirmation to ${to} via ${provider}…`);
  const msg = applicantConfirmation({ applicationId: "AGRA-2026-TEST00", submittedAt: new Date().toISOString(), firstName: "Test", email: to, businessName: "Sample Farms (test)" });
  const r = await sendEmail({ ...msg, idempotencyKey: `test-${Date.now()}` });
  if (r.ok) { console.log(`✔ Sent. Check the inbox (and the Spam folder) of ${to}.\n  Once this works here, add the same settings on Vercel and redeploy.\n`); return; }
  console.error(`✘ Not sent: ${r.reason}`);
  if (/GMAIL_LOGIN_REJECTED/.test(r.reason)) console.error("  → Use a Google App Password (16 letters), not the normal Gmail password. 2-Step Verification must be on.");
  if (/DOMAIN_NOT_VERIFIED/.test(r.reason)) console.error("  → Verify your domain in Resend and make EMAIL_FROM an address on that domain.");
  if (/LIMIT/.test(r.reason)) console.error("  → The daily sending limit was reached. Try again tomorrow, or move to a paid Resend plan.");
  process.exit(1);
})();
