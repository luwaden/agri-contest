import { PROGRAMME } from "@/config/programme";
import { IMPLEMENTER_WEBSITE, IMPLEMENTER_WEBSITE_LABEL } from "@/config/implementer";
import { replyTo, type EmailMessage } from "./send";

/**
 * Email wording. Only facts the site already states are used: the reference number, the submission time, that the
 * programme team reviews all applications and contacts shortlisted applicants, and one application per email address.
 * No dates, prizes or selection numbers are promised here. The applicant's answers are never repeated in an email.
 */
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const when = (iso: string | null | undefined) =>
  new Date(iso || Date.now()).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " (WAT)";

function layout(title: string, paragraphs: string[], ref: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f6f2;font-family:Arial,Helvetica,sans-serif;color:#1d2a20">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#0f3d24;color:#ffffff;border-radius:12px 12px 0 0;padding:18px 22px;font-weight:bold;font-size:16px">${esc(PROGRAMME.name)}</div>
<div style="background:#ffffff;border-radius:0 0 12px 12px;padding:22px">
<h1 style="margin:0 0 16px;font-size:20px;color:#0f3d24">${esc(title)}</h1>
<div style="margin:0 0 18px;padding:12px 14px;background:#f0f7e6;border-radius:8px;font-size:14px">Reference number<br><strong style="font-family:Consolas,monospace;font-size:20px;letter-spacing:.5px">${esc(ref)}</strong></div>
${body}
</div>
<p style="font-size:12px;color:#5b6b60;line-height:1.5;margin:14px 4px 0">You are receiving this because this email address was used on the ${esc(PROGRAMME.shortName)} website${site() ? ` (${esc(site())})` : ""}. Delivered by ${esc(PROGRAMME.deliveredBy)}, <a href="${IMPLEMENTER_WEBSITE}" style="color:#5b6b60">${IMPLEMENTER_WEBSITE_LABEL}</a>.</p>
</div></body></html>`;
}

export function applicantConfirmation(a: { applicationId: string; submittedAt: string | null; firstName: string; email: string; businessName?: string }): EmailMessage {
  const name = a.firstName?.trim() || "applicant";
  const contact = replyTo();
  const lines = [
    `Dear ${esc(name)},`,
    `Thank you for applying to the ${esc(PROGRAMME.name)}. We have received your application${a.businessName ? ` for <strong>${esc(a.businessName)}</strong>` : ""}, submitted on ${esc(when(a.submittedAt))}.`,
    `<strong>What happens next:</strong> the programme team reviews all applications and will contact shortlisted applicants.`,
    `Please keep your reference number. Only one application can be submitted per email address.`,
    `Questions? Reply to this email or write to <a href="mailto:${esc(contact)}" style="color:#0b63a8">${esc(contact)}</a>, quoting your reference number.`,
    `The ${esc(PROGRAMME.shortName)} team`,
  ];
  const text = [
    `Dear ${name},`, "",
    `Thank you for applying to the ${PROGRAMME.name}. We have received your application${a.businessName ? ` for ${a.businessName}` : ""}, submitted on ${when(a.submittedAt)}.`, "",
    `Reference number: ${a.applicationId}`, "",
    "What happens next: the programme team reviews all applications and will contact shortlisted applicants.", "",
    "Please keep your reference number. Only one application can be submitted per email address.", "",
    `Questions? Reply to this email or write to ${contact}, quoting your reference number.`, "",
    `The ${PROGRAMME.shortName} team`, "",
    `Delivered by ${PROGRAMME.deliveredBy}, ${IMPLEMENTER_WEBSITE_LABEL}`,
  ].join("\n");
  return { to: a.email, subject: `Application received: ${a.applicationId}`, html: layout("We have received your application", lines, a.applicationId), text, idempotencyKey: `app-confirm-${a.applicationId}` };
}
