import "server-only";
import { PROGRAMME } from "@/config/programme";

/**
 * Sends one email through whichever service is configured. Off when nothing is set: the site works exactly as before.
 *
 *   Gmail (no domain needed, about 500 emails a day):  GMAIL_USER + GMAIL_APP_PASSWORD
 *   Resend (needs a domain you own):                   RESEND_API_KEY + EMAIL_FROM  (e.g. "Youth Agri-Innovation Contest <apply@yourdomain.org>")
 *
 * If both are set, Resend is used. Replies go to EMAIL_REPLY_TO (default: the programme contact address).
 * Never throws: a failed email must never fail an application.
 */
export type EmailProvider = "resend" | "gmail" | "off";
export interface EmailMessage { to: string; subject: string; html: string; text: string; idempotencyKey?: string }
export type SendResult = { ok: true; provider: EmailProvider; id?: string } | { ok: false; provider: EmailProvider; reason: string };

export function emailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  return "off";
}

/** Plain explanation of what is configured, for the system check (never shows secrets). */
export function emailSetupProblem(): string | null {
  if (process.env.RESEND_API_KEY && !process.env.EMAIL_FROM) return "RESEND_API_KEY is set but EMAIL_FROM is missing (it must be an address on your verified domain).";
  if (process.env.EMAIL_FROM && /@(gmail|yahoo|outlook|hotmail)\./i.test(process.env.EMAIL_FROM) && process.env.RESEND_API_KEY) return "EMAIL_FROM is a Gmail/Yahoo/Outlook address. Resend can only send from a domain you own and have verified.";
  if (process.env.GMAIL_USER && !process.env.GMAIL_APP_PASSWORD) return "GMAIL_USER is set but GMAIL_APP_PASSWORD is missing.";
  if (process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_APP_PASSWORD.replace(/\s/g, "").length !== 16) return "GMAIL_APP_PASSWORD should be the 16-letter app password from Google (not your normal Gmail password).";
  return null;
}

export const replyTo = () => process.env.EMAIL_REPLY_TO || PROGRAMME.contactEmail;
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 200);

export async function sendEmail(m: EmailMessage): Promise<SendResult> {
  const provider = emailProvider();
  if (provider === "off") return { ok: false, provider, reason: "EMAIL_OFF" };
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(m.to)) return { ok: false, provider, reason: "BAD_ADDRESS" };
  const subject = oneLine(m.subject);
  try {
    if (provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", ...(m.idempotencyKey ? { "Idempotency-Key": m.idempotencyKey } : {}) },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [m.to], reply_to: replyTo(), subject, html: m.html, text: m.text }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, provider, id: body?.id };
      const reason = res.status === 429 ? "DAILY_LIMIT_OR_RATE_LIMIT" : res.status === 403 ? "DOMAIN_NOT_VERIFIED" : `HTTP_${res.status}`;
      return { ok: false, provider, reason: `${reason}: ${oneLine(String(body?.message ?? ""))}` };
    }
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s/g, "") },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    });
    const info = await transport.sendMail({
      from: { name: PROGRAMME.shortName, address: process.env.GMAIL_USER! }, to: m.to, replyTo: replyTo(), subject, html: m.html, text: m.text,
    });
    return { ok: true, provider, id: info.messageId };
  } catch (e) {
    const msg = (e as Error).message ?? "error";
    const reason = /Invalid login|BadCredentials|535/i.test(msg) ? "GMAIL_LOGIN_REJECTED" : /limit|quota|550 5\.4\.5|421/i.test(msg) ? "DAILY_LIMIT_OR_RATE_LIMIT" : /timeout|abort/i.test(msg) ? "TIMEOUT" : "SEND_FAILED";
    return { ok: false, provider, reason: `${reason}: ${oneLine(msg)}` };
  }
}
