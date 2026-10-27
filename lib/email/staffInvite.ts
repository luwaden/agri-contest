import "server-only";
import { sendEmail, type SendResult } from "./send";
import { teamMessage } from "./templates";
import { PROGRAMME } from "@/config/programme";
import { roleLabel } from "@/lib/auth/permissions";
import type { StaffRole } from "@/types/user";

/**
 * Emails a staff member their one-time password link (invite: first password; reset: new password).
 * Sent from the normal programme address. The link is also returned to the admin screen in case email fails.
 */
export async function emailPasswordLink(p: { name: string; email: string; role: StaffRole; link: string; expiresAt: string; purpose: "invite" | "reset"; site: string }): Promise<SendResult> {
  const first = p.name.trim().split(/\s+/)[0] || "there";
  const until = new Date(p.expiresAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const invite = p.purpose === "invite";
  const role = roleLabel(p.role).toLowerCase();
  const body = invite
    ? `Dear ${first},\n\nThe programme team has created a ${role} account for you on the ${PROGRAMME.shortName} portal.\n\nTo start, open the link below and choose your password. It works once and expires on ${until} (Nigerian time).\n\n${p.link}\n\nAfterwards, sign in at ${p.site}/admin/login with this email address (${p.email}).\n\nIf you were not expecting this, you can ignore this email.\n\nThe ${PROGRAMME.shortName} team`
    : `Dear ${first},\n\nA new password was requested for your ${PROGRAMME.shortName} staff account.\n\nOpen the link below and choose a new password. It works once and expires on ${until} (Nigerian time).\n\n${p.link}\n\nIf you did not ask for this, you can ignore this email: your current password still works.\n\nThe ${PROGRAMME.shortName} team`;
  const msg = teamMessage({ to: p.email, subject: invite ? `Your ${role} account: choose your password` : "Choose a new password", heading: invite ? `Welcome, ${first}` : "Choose a new password", body, ref: null, key: `pwlink-${p.email}-${Date.now()}` });
  // Make the link a clear button in the HTML version (the plain-text version keeps the bare link).
  const button = `<a href="${p.link}" style="display:inline-block;background:#0f3d24;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${invite ? "Choose my password" : "Choose a new password"}</a>`;
  return sendEmail({ ...msg, html: msg.html.replace(p.link, button) });
}
