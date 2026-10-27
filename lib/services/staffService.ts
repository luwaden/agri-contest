import { z } from "zod";
import { getRepository } from "@/lib/repository";
import { createPasswordLink, findStaff, hashLooksValid, invalidateStaffCache, listStaff, loadStaff, newUserId } from "@/lib/auth/users";
import { passwordResetAvailable, revokeSessions } from "@/lib/auth/passwords";
import { emailPasswordLink } from "@/lib/email/staffInvite";
import { emailProvider } from "@/lib/email/send";
import type { StaffRole } from "@/types/user";
import type { StaffAccount, StaffSummary } from "@/types/staff";
import type { ServiceResult } from "./applicationService";

const ROLE = z.enum(["ADMIN", "COORDINATOR", "JUDGE", "REVIEWER"]);
const addSchema = z.object({
  name: z.string().trim().min(2, "Please enter the person's full name.").max(80, "Please keep the name under 80 characters.").regex(/^[^=+@<>]/, "Please enter a plain name."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  role: ROLE,
  /** Also email the invite link to the person (default). */
  send: z.boolean().default(true),
});
const patchSchema = z.object({ email: z.string().trim().toLowerCase().email(), role: ROLE.optional(), active: z.boolean().optional() })
  .refine((p) => p.role !== undefined || p.active !== undefined, "Nothing to change.");

type Out = { staff: StaffSummary[]; link?: string; expiresAt?: string; emailed?: boolean; emailProblem?: string };
const NO_SECRET = { ok: false as const, status: 503, body: { message: "Password links need SESSION_SECRET (32+ characters) in the server settings." } };

/** Creates the invite link and, if asked, emails it. The link is always returned so the admin can send it another way. */
async function inviteLink(name: string, email: string, role: StaffRole, origin: string, send: boolean) {
  const { token, expiresAt } = await createPasswordLink(email, "invite");
  const link = `${origin}/reset-password?token=${token}`;
  if (!send) return { link, expiresAt, emailed: false };
  if (emailProvider() === "off") return { link, expiresAt, emailed: false, emailProblem: "Email is not set up on this server, so copy the link and send it yourself." };
  const r = await emailPasswordLink({ name, email, role, link, expiresAt, purpose: "invite", site: origin });
  return r.ok ? { link, expiresAt, emailed: true } : { link, expiresAt, emailed: false, emailProblem: `The email was not sent (${r.reason.split(":")[0]}). Copy the link and send it yourself.` };
}

/** There must always be at least one active administrator who can actually sign in. */
function keepsAnAdmin(accounts: StaffAccount[], email: string, patch: { role?: StaffRole; active?: boolean }) {
  const after = accounts.map((a) => (a.email === email ? { ...a, ...patch } : a));
  return after.some((a) => a.role === "ADMIN" && a.active && hashLooksValid(a.passwordHash));
}

export async function addStaff(input: unknown, actor: string, origin: string): Promise<ServiceResult<Out>> {
  const p = addSchema.safeParse(input);
  if (!p.success) return { ok: false, status: 400, body: { message: p.error.issues[0].message } };
  if (!passwordResetAvailable()) return NO_SECRET;
  const { name, email, role, send } = p.data;
  if (await findStaff(email, true)) return { ok: false, status: 409, body: { message: "Someone with that email already has an account." } };
  try {
    await getRepository().createStaff({ userId: newUserId(), name, email, role, active: true, note: `added by ${actor}`, passwordHash: "", updatedAt: new Date().toISOString(), source: "sheet" });
  } catch (e) {
    if ((e as Error).message === "DUPLICATE_EMAIL") return { ok: false, status: 409, body: { message: "Someone with that email already has an account." } };
    throw e;
  }
  invalidateStaffCache();
  const inv = await inviteLink(name, email, role, origin, send);
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor, action: "STAFF_ADDED", detail: `${email} as ${role}${inv.emailed ? " | invite emailed" : ""}` }).catch(() => undefined);
  return { ok: true, status: 201, data: { staff: await listStaff(), ...inv } };
}

export async function changeStaff(input: unknown, actor: string): Promise<ServiceResult<Out>> {
  const p = patchSchema.safeParse(input);
  if (!p.success) return { ok: false, status: 400, body: { message: "Please choose a valid change." } };
  const { email, role, active } = p.data;
  if (email === actor.toLowerCase()) return { ok: false, status: 400, body: { message: "You cannot change your own role or deactivate yourself. Ask another administrator." } };
  const { accounts } = await loadStaff({ fresh: true });
  const target = accounts.find((a) => a.email === email);
  if (!target) return { ok: false, status: 404, body: { message: "That account no longer exists." } };
  if (target.source === "env") return { ok: false, status: 400, body: { message: "This account is set in the ADMIN_USERS_JSON setting on Vercel. Change it there and redeploy." } };
  if (!keepsAnAdmin(accounts, email, { ...(role ? { role } : {}), ...(active !== undefined ? { active } : {}) }))
    return { ok: false, status: 400, body: { message: "That would leave no active administrator who can sign in." } };
  await getRepository().updateStaff(email, { ...(role ? { role } : {}), ...(active !== undefined ? { active } : {}) });
  if (active === false) await revokeSessions(email);
  invalidateStaffCache();
  const what = active === false ? "STAFF_DEACTIVATED" : active === true ? "STAFF_REACTIVATED" : "STAFF_ROLE_CHANGED";
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor, action: what, detail: `${email}${role ? ` → ${role}` : ""}` }).catch(() => undefined);
  return { ok: true, status: 200, data: { staff: await listStaff() } };
}

// ───────────── panel applications → staff accounts ─────────────
export type PanelRole = "REVIEWER" | "JUDGE";
const PANEL_ROLES: PanelRole[] = ["REVIEWER", "JUDGE"];
/** What they applied for decides the suggested account: judges get a Judge account, everyone else a Reviewer account. */
const suggestedRole = (roles?: string[]): PanelRole => (roles?.includes("JUDGE") ? "JUDGE" : "REVIEWER");

export interface PanelCandidate {
  mentorId: string; name: string; email: string; state: string; profession: string; organization: string;
  appliedAs: string[]; status: string; submittedAt: string; suggestedRole: PanelRole;
  account: { role: StaffRole; status: StaffSummary["status"] } | null;
}

/** Everyone who applied through the panel form, with whether they already have an account. */
export async function panelCandidates(): Promise<PanelCandidate[]> {
  const [mentors, staff] = await Promise.all([getRepository().getMentors(), listStaff()]);
  const byEmail = new Map(staff.map((s) => [s.email, s]));
  return [...mentors].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((m) => {
    const email = m.email.trim().toLowerCase(), acct = byEmail.get(email);
    return { mentorId: m.mentorId, name: ([m.firstName, m.lastName].filter(Boolean).join(" ") || m.fullName).trim(), email, state: m.state, profession: m.profession, organization: m.organization,
      appliedAs: m.roles?.length ? m.roles : ["MENTOR"], status: m.status, submittedAt: m.submittedAt, suggestedRole: suggestedRole(m.roles),
      account: acct ? { role: acct.role, status: acct.status } : null };
  });
}

const inviteSchema = z.object({ people: z.array(z.object({ mentorId: z.string().min(3).max(40), role: z.enum(["REVIEWER", "JUDGE"]) })).min(1, "Tick at least one person.").max(30, "At most 30 people at a time."), send: z.boolean().default(true) });
export interface InviteResult { mentorId: string; name: string; email: string; role: PanelRole; outcome: "created" | "already" | "failed"; emailed: boolean; link?: string; expiresAt?: string; message?: string }

/**
 * For each ticked panel applicant: create a staff account with the chosen role, email them their invite link,
 * and mark the panel application ACCEPTED. People who already have an account are left as they are.
 */
export async function invitePanel(input: unknown, actor: string, origin: string): Promise<ServiceResult<{ results: InviteResult[]; staff: StaffSummary[] }>> {
  const p = inviteSchema.safeParse(input);
  if (!p.success) return { ok: false, status: 400, body: { message: p.error.issues[0].message } };
  if (!passwordResetAvailable()) return NO_SECRET;
  const mentors = new Map((await getRepository().getMentors()).map((m) => [m.mentorId, m]));
  const results: InviteResult[] = [];
  for (const { mentorId, role } of p.data.people) {
    const m = mentors.get(mentorId);
    if (!m) { results.push({ mentorId, name: "", email: "", role, outcome: "failed", emailed: false, message: "Panel application not found." }); continue; }
    const name = ([m.firstName, m.lastName].filter(Boolean).join(" ") || m.fullName).replace(/^[=+@<>\s]+/, "").trim().slice(0, 80) || "Panel member";
    const email = m.email.trim().toLowerCase();
    const base = { mentorId, name, email, role };
    if (!z.string().email().safeParse(email).success) { results.push({ ...base, outcome: "failed", emailed: false, message: "The email address on the application is not valid." }); continue; }
    if (await findStaff(email, true)) { results.push({ ...base, outcome: "already", emailed: false, message: "Already has an account." }); continue; }
    try {
      await getRepository().createStaff({ userId: newUserId(), name, email, role, active: true, note: `from panel application ${mentorId}, added by ${actor}`, passwordHash: "", updatedAt: new Date().toISOString(), source: "sheet" });
    } catch (e) {
      if ((e as Error).message === "DUPLICATE_EMAIL") { results.push({ ...base, outcome: "already", emailed: false, message: "Already has an account." }); continue; }
      throw e;
    }
    invalidateStaffCache();
    const inv = await inviteLink(name, email, role, origin, p.data.send);
    if (m.status !== "ACCEPTED") await getRepository().updateMentorStatus(mentorId, "ACCEPTED", actor).catch(() => null);
    await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor, action: "STAFF_ADDED", detail: `${email} as ${role} from panel application ${mentorId}${inv.emailed ? " | invite emailed" : ""}` }).catch(() => undefined);
    results.push({ ...base, outcome: "created", emailed: inv.emailed, link: inv.link, expiresAt: inv.expiresAt, message: inv.emailProblem });
  }
  return { ok: true, status: 200, data: { results, staff: await listStaff() } };
}

/** A fresh invite or reset link for an existing account, emailed to them (and returned to copy). */
export async function sendPasswordLink(email: string, actor: string, origin: string, send: boolean): Promise<ServiceResult<{ link: string; expiresAt: string; purpose: "invite" | "reset"; emailed: boolean; emailProblem?: string; name: string }>> {
  if (!passwordResetAvailable()) return NO_SECRET;
  const e = email.trim().toLowerCase();
  const person = (await listStaff()).find((u) => u.email === e);
  if (!person) return { ok: false, status: 400, body: { message: "That email is not a staff account." } };
  if (person.status === "deactivated") return { ok: false, status: 400, body: { message: "Reactivate this account first." } };
  const purpose = person.status === "invited" ? "invite" : "reset";
  const { token, expiresAt } = await createPasswordLink(e, purpose);
  const link = `${origin}/reset-password?token=${token}`;
  let emailed = false, emailProblem: string | undefined;
  if (send) {
    if (emailProvider() === "off") emailProblem = "Email is not set up on this server, so copy the link and send it yourself.";
    else { const r = await emailPasswordLink({ name: person.name, email: e, role: person.role, link, expiresAt, purpose, site: origin }); emailed = r.ok; if (!r.ok) emailProblem = `The email was not sent (${r.reason.split(":")[0]}). Copy the link and send it yourself.`; }
  }
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor, action: "RESET_LINK_CREATED", detail: `${purpose} link for ${e}${emailed ? " | emailed" : ""}` }).catch(() => undefined);
  return { ok: true, status: 200, data: { link, expiresAt, purpose, emailed, emailProblem, name: person.name } };
}
