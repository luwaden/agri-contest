import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getRepository } from "@/lib/repository";
import { emailProvider, emailSetupProblem, sendEmail } from "@/lib/email/send";
import { teamMessage } from "@/lib/email/templates";
import { listSpecSchema, buildList } from "@/lib/screening/customList";
import { isLiveReview } from "@/types/review";
import { buildResults } from "@/lib/judging";
import type { Application, ApplicationStatus } from "@/types/application";
import type { EmailCampaign, EmailLogRow } from "@/types/email";
import type { ServiceResult } from "./applicationService";
import { loadStaff } from "@/lib/auth/users";
import { rankedData } from "./screeningService";

/**
 * MESSAGES TO APPLICANTS (Admin → Messages).
 *
 *   choose who ─▶ write (with fill-ins) ─▶ preview + test to yourself ─▶ save the campaign ─▶ send in small batches
 *
 * Mail goes out through the configured sender (GMAIL_USER, or Resend's EMAIL_FROM): the same address as the
 * confirmation emails. Nobody gets the same campaign twice: the Email Log is checked before every batch.
 * Gmail allows about 500 emails a day, so sending stops at EMAIL_DAILY_LIMIT and continues the next day.
 */
const BATCH = 20;
export const MAX_RECIPIENTS = 2000;
export const dailyLimit = () => Number(process.env.EMAIL_DAILY_LIMIT) || (emailProvider() === "resend" ? 5000 : 450);
const fail = (status: number, message: string, extra: Record<string, unknown> = {}) => ({ ok: false as const, status, body: { message, ...extra } });
const now = () => new Date().toISOString();
const lagosDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

// ───────────── who receives it ─────────────
/**
 * A recipient is an applicant (stored by reference number) or any other person (stored as "ext:email|Name").
 * Other people get the same message without a reference box, and the applicant-only fill-ins are empty for them.
 */
export interface Recipient { key: string; stored: string; email: string; firstName: string; lastName: string; applicationId: string | null; businessName: string; state: string }
const EMAIL_RE = /[^\s<>,;"'()]+@[^\s<>,;"'()]+\.[a-z]{2,}/gi;
const REF_RE = /AGRA-\d{4}-[2-9A-HJKMNP-Z]{6}/gi;
const cleanName = (s: string) => s.replace(/[|<>"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
const splitName = (name: string) => { const p = cleanName(name).split(" ").filter(Boolean); return { firstName: p[0] ?? "", lastName: p.slice(1).join(" ") }; };
const fromApp = (a: Application): Recipient => ({ key: a.applicationId, stored: a.applicationId, email: a.applicant.email.trim(), firstName: a.applicant.firstName.trim(), lastName: a.applicant.lastName.trim(), applicationId: a.applicationId, businessName: a.business.businessName.trim(), state: a.location.state });
const external = (email: string, name = "", state = ""): Recipient => {
  const e = email.trim(), n = cleanName(name);
  return { key: `ext:${e.toLowerCase()}`, stored: `ext:${e}|${n}`, email: e, ...splitName(n), applicationId: null, businessName: "", state };
};
const fromStored = (stored: string, apps: Map<string, Application>): Recipient | null => {
  if (stored.startsWith("ext:")) { const [email, name = ""] = stored.slice(4).split("|"); return external(email, name); }
  const a = apps.get(stored); return a ? fromApp(a) : null;
};
/** The key a log line belongs to (older lines only have application ids). */
const logKey = (l: EmailLogRow) => (l.applicationId === "EXTERNAL" ? `ext:${l.email.trim().toLowerCase()}` : l.applicationId);

export const audienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("batch") }),                                       // with screening reviewers
  z.object({ kind: z.literal("passed") }),                                      // passed by a reviewer
  z.object({ kind: z.literal("judges") }),                                      // with judges
  z.object({ kind: z.literal("finalists"), n: z.coerce.number().int().min(1).max(500).default(30) }),   // top N by judges' average
  z.object({ kind: z.literal("top"), n: z.coerce.number().int().min(1).max(MAX_RECIPIENTS) }),           // top N eligible by pre-score
  z.object({ kind: z.literal("status"), status: z.enum(["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "NOT_SELECTED", "FINALIST", "WINNER"]) }),
  z.object({ kind: z.literal("list"), spec: listSpecSchema }),                  // a list built under Screening → Quick requests
  z.object({ kind: z.literal("staff"), role: z.enum(["PANEL", "REVIEWER", "JUDGE", "ALL"]).default("PANEL") }),   // people with sign-in accounts
  z.object({ kind: z.literal("mentors"), status: z.enum(["ANY", "NEW", "UNDER_REVIEW", "ACCEPTED", "DECLINED"]).default("ACCEPTED") }),   // panel applications
  z.object({ kind: z.literal("pasted"), text: z.string().max(200_000) }),       // references and/or ANY email addresses, with optional names
]);
export type Audience = z.infer<typeof audienceSchema>;

/** "Amina Bello <amina@x.org>", "amina@x.org, Amina Bello", "AGRA-2026-K7QX4M", or several addresses on one line. */
export function parsePasted(text: string, apps: Map<string, Application>, byEmail: Map<string, Application>) {
  const out: Recipient[] = [], notFound: string[] = [];
  for (const raw of text.split(/\r?\n|;/)) {
    const line = raw.trim(); if (!line) continue;
    const refs = line.match(REF_RE) ?? [], emails = line.match(EMAIL_RE) ?? [];
    for (const r of refs) { const a = apps.get(r.toUpperCase()); if (a) out.push(fromApp(a)); else notFound.push(r); }
    if (emails.length === 1) {
      const a = byEmail.get(emails[0].toLowerCase());
      const name = line.replace(emails[0], " ").replace(REF_RE, " ").replace(/[<>,"']/g, " ");
      out.push(a ? fromApp(a) : external(emails[0], name));
    } else for (const e of emails) { const a = byEmail.get(e.toLowerCase()); out.push(a ? fromApp(a) : external(e)); }
    if (!refs.length && !emails.length) notFound.push(line.slice(0, 60));
  }
  return { out, notFound };
}

async function resolve(aud: Audience): Promise<{ list: Recipient[]; label: string; notFound: string[]; others: number; invalid: string[] }> {
  const d = await rankedData();
  const live = (role: "REVIEWER" | "JUDGE", passedOnly = false) => new Set(d.reviews.filter((r) => r.panelRole === role && isLiveReview(r) && (!passedOnly || r.decision === "PASS")).map((r) => r.applicationId));
  const pick = (ids: Iterable<string>) => [...ids].map((id) => d.apps.get(id)).filter((a): a is Application => !!a && a.submissionStatus !== "DRAFT").map(fromApp);
  let list: Recipient[] = [], label = "", notFound: string[] = [];
  switch (aud.kind) {
    case "batch": list = pick(live("REVIEWER")); label = "Applications with screening reviewers"; break;
    case "passed": list = pick(live("REVIEWER", true)); label = "Passed by reviewers"; break;
    case "judges": list = pick(live("JUDGE")); label = "Applications with judges"; break;
    case "finalists": list = pick(buildResults(d.applications, d.reviews, "JUDGE").filter((r) => r.average !== null).slice(0, aud.n).map((r) => r.applicationId)); label = `Top ${aud.n} by judges' scores`; break;
    case "top": list = pick(d.ranked.slice(0, aud.n).map((p) => p.applicationId)); label = `Top ${aud.n} eligible by pre-score`; break;
    case "status": list = pick(d.applications.filter((a) => a.submissionStatus === (aud.status as ApplicationStatus)).map((a) => a.applicationId)); label = `Status: ${aud.status}`; break;
    case "list": list = pick(buildList(d.ranked, d.applications, aud.spec).rows.map((r) => r.applicationId)); label = `Custom list (${aud.spec.size})`; break;
    case "staff": {
      const roles = aud.role === "PANEL" ? ["REVIEWER", "JUDGE"] : aud.role === "ALL" ? ["ADMIN", "COORDINATOR", "REVIEWER", "JUDGE"] : [aud.role];
      list = (await loadStaff()).accounts.filter((s) => s.active && roles.includes(s.role)).map((s) => external(s.email, s.name));
      label = { PANEL: "Judges and reviewers (staff accounts)", REVIEWER: "Reviewers (staff accounts)", JUDGE: "Judges (staff accounts)", ALL: "All staff accounts" }[aud.role]; break;
    }
    case "mentors": {
      list = (await getRepository().getMentors()).filter((m) => aud.status === "ANY" || m.status === aud.status)
        .map((m) => ({ ...external(m.email, [m.firstName, m.lastName].filter(Boolean).join(" ") || m.fullName), state: m.state }));
      label = `Panel applications${aud.status === "ANY" ? "" : ` (${aud.status.toLowerCase().replace("_", " ")})`}`; break;
    }
    case "pasted": {
      const byEmail = new Map(d.applications.filter((a) => a.submissionStatus !== "DRAFT").map((a) => [a.applicant.email.trim().toLowerCase(), a]));
      ({ out: list, notFound } = parsePasted(aud.text, d.apps, byEmail)); label = "Pasted list"; break;
    }
  }
  // One email each, valid addresses only.
  const seen = new Set<string>(), invalid: string[] = [];
  list = list.filter((r) => { const e = r.email.toLowerCase(); if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(e)) { invalid.push(r.applicationId ?? (r.email || "(blank)")); return false; } if (seen.has(e)) return false; seen.add(e); return true; });
  return { list, label: `${label} (${list.length})`, notFound: notFound.slice(0, 50), others: list.filter((r) => !r.applicationId).length, invalid };
}

// ───────────── the message ─────────────
export const FILL_INS = { first_name: "First name", last_name: "Surname", full_name: "Full name", application_id: "Reference number (applicants)", business_name: "Business name (applicants)", state: "State" } as const;
const APPLICANT_ONLY = ["application_id", "business_name"];
const fillIn = (r: Recipient, key: string): string => ({
  first_name: r.firstName || (r.applicationId ? "applicant" : "there"), last_name: r.lastName, full_name: `${r.firstName} ${r.lastName}`.trim(),
  application_id: r.applicationId ?? "", business_name: r.businessName, state: r.state,
} as Record<string, string>)[key] ?? "";
const fill = (t: string, r: Recipient) => t.replace(/\{(\w+)\}/g, (m, k) => (k in FILL_INS ? fillIn(r, k) : m));
export function unknownFillIns(...texts: string[]) { return [...new Set(texts.flatMap((t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1])).filter((k) => !(k in FILL_INS)))]; }
const usesApplicantOnly = (...texts: string[]) => texts.some((t) => APPLICANT_ONLY.some((k) => t.includes(`{${k}}`)));

const messageSchema = z.object({
  subject: z.string().trim().min(3, "Write a subject.").max(150),
  heading: z.string().trim().max(120).default(""),
  body: z.string().trim().min(10, "Write the message.").max(8000),
});
const composeSchema = messageSchema.extend({ audience: audienceSchema });

function render(m: z.infer<typeof messageSchema>, r: Recipient, key: string) {
  return teamMessage({ to: r.email, subject: fill(m.subject, r), heading: fill(m.heading || m.subject, r), body: fill(m.body, r), ref: r.applicationId, key });
}
const tooBig = (list: Recipient[]) => JSON.stringify(list.map((r) => r.stored)).length > 45_000;   // one sheet cell holds 50,000 characters

export async function preview(input: unknown): Promise<ServiceResult<Record<string, unknown>>> {
  const p = composeSchema.safeParse(input);
  if (!p.success) return fail(422, p.error.issues[0]?.message ?? "Please check the message.");
  const bad = unknownFillIns(p.data.subject, p.data.heading, p.data.body);
  if (bad.length) return fail(422, `Unknown fill-in: {${bad.join("}, {")}}. You can use: ${Object.keys(FILL_INS).map((k) => `{${k}}`).join(", ")}.`);
  const r = await resolve(p.data.audience);
  if (r.list.length > MAX_RECIPIENTS || tooBig(r.list)) return fail(422, `That is ${r.list.length} people, too many for one message. Split the group (at most ${MAX_RECIPIENTS}).`);
  const first = r.list[0];
  const warnings = [
    ...(r.others && usesApplicantOnly(p.data.subject, p.data.heading, p.data.body) ? [`${r.others} recipient(s) are not applicants: {application_id} and {business_name} will be empty for them.`] : []),
    ...(r.invalid.length ? [`${r.invalid.length} left out because their email address is not valid: ${r.invalid.slice(0, 10).join(", ")}${r.invalid.length > 10 ? "…" : ""}`] : []),
  ];
  return { ok: true, status: 200, data: {
    count: r.list.length, others: r.others, label: r.label, notFound: r.notFound, warnings,
    sample: r.list.slice(0, 8).map((x) => ({ applicationId: x.applicationId ?? "not an applicant", name: fillIn(x, "full_name") || "(no name)", email: x.email })),
    email: first ? (({ subject, html, text }) => ({ subject, html, text, to: first.email }))(render(p.data, first, "preview")) : null,
    sender: emailProvider(), senderProblem: emailSetupProblem(), dailyLimit: dailyLimit(),
  } };
}

/** Sends the message, filled in for the first recipient, to the signed-in administrator only. */
export async function sendTest(input: unknown, me: string): Promise<ServiceResult<Record<string, unknown>>> {
  const p = composeSchema.safeParse(input);
  if (!p.success) return fail(422, p.error.issues[0]?.message ?? "Please check the message.");
  if (emailProvider() === "off") return fail(503, "Email is not set up on this server (GMAIL_USER and GMAIL_APP_PASSWORD).");
  const r = await resolve(p.data.audience);
  if (!r.list.length) return fail(422, "Nobody is in that group, so there is nothing to fill in.");
  const msg = render(p.data, r.list[0], `test-${randomBytes(6).toString("hex")}`);
  const sent = await sendEmail({ ...msg, to: me, subject: `[TEST] ${msg.subject}` });
  await getRepository().appendEmailLog([{ at: now(), campaignId: "TEST", applicationId: r.list[0].applicationId ?? "EXTERNAL", email: me, status: "TEST", detail: sent.ok ? "sent to the administrator" : sent.reason }]).catch(() => {});
  return sent.ok ? { ok: true, status: 200, data: { sentTo: me } } : fail(502, `The test was not sent: ${sent.reason}`);
}

export async function createCampaign(input: unknown, actor: string): Promise<ServiceResult<{ campaign: CampaignView }>> {
  const p = composeSchema.safeParse(input);
  if (!p.success) return fail(422, p.error.issues[0]?.message ?? "Please check the message.");
  const bad = unknownFillIns(p.data.subject, p.data.heading, p.data.body);
  if (bad.length) return fail(422, `Unknown fill-in: {${bad.join("}, {")}}.`);
  if (emailProvider() === "off") return fail(503, "Email is not set up on this server (GMAIL_USER and GMAIL_APP_PASSWORD).");
  const r = await resolve(p.data.audience);
  if (!r.list.length) return fail(422, "Nobody is in that group.");
  if (r.list.length > MAX_RECIPIENTS || tooBig(r.list)) return fail(422, `Too many people for one message (at most ${MAX_RECIPIENTS}); split the group.`);
  // The heading travels inside the stored body so the Email Campaigns tab keeps its 7 columns.
  const c: EmailCampaign = { campaignId: `MSG-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`, createdAt: now(), createdBy: actor,
    subject: p.data.subject, body: p.data.heading ? `#${p.data.heading}\n${p.data.body}` : p.data.body, audience: r.label, recipientIds: r.list.map((x) => x.stored) };
  await getRepository().createEmailCampaign(c);
  await getRepository().logEvent({ at: c.createdAt, applicationId: "-", actor, action: "EMAIL_CAMPAIGN_CREATED", detail: `${c.campaignId} | ${c.audience}${r.others ? ` | ${r.others} not applicants` : ""} | ${c.subject}`.slice(0, 480) });
  return { ok: true, status: 200, data: { campaign: view(c, []) } };
}
const splitBody = (body: string) => (body.startsWith("#") ? { heading: body.slice(1, body.indexOf("\n") === -1 ? undefined : body.indexOf("\n")), body: body.indexOf("\n") === -1 ? "" : body.slice(body.indexOf("\n") + 1) } : { heading: "", body });
const keyOfStored = (s: string) => (s.startsWith("ext:") ? `ext:${s.slice(4).split("|")[0].trim().toLowerCase()}` : s);

// ───────────── progress ─────────────
export interface CampaignView { campaignId: string; createdAt: string; createdBy: string; subject: string; audience: string; total: number; sent: number; failed: number; remaining: number; cancelled: boolean; lastErrors: string[] }
function view(c: EmailCampaign, log: EmailLogRow[]): CampaignView {
  const mine = log.filter((l) => l.campaignId === c.campaignId);
  const sent = new Set(mine.filter((l) => l.status === "SENT").map(logKey));
  const failedIds = new Set(mine.filter((l) => l.status === "FAILED" && !sent.has(logKey(l))).map(logKey));
  return { campaignId: c.campaignId, createdAt: c.createdAt, createdBy: c.createdBy, subject: c.subject, audience: c.audience, total: c.recipientIds.length,
    sent: sent.size, failed: failedIds.size, remaining: c.recipientIds.map(keyOfStored).filter((k) => !sent.has(k) && !gaveUp(mine, k)).length,
    cancelled: mine.some((l) => l.status === "CANCELLED"), lastErrors: [...new Set(mine.filter((l) => l.status === "FAILED").slice(-5).map((l) => l.detail.slice(0, 120)))] };
}
/** A bad address is never retried; any other failure is retried up to 3 attempts in all. */
const gaveUp = (mine: EmailLogRow[], key: string) => { const f = mine.filter((l) => logKey(l) === key && l.status === "FAILED"); return f.some((l) => /BAD_ADDRESS/.test(l.detail)) || f.length >= 3; };

export async function listCampaigns() {
  const repo = getRepository();
  const [campaigns, log] = await Promise.all([repo.getEmailCampaigns(), repo.getEmailLog()]);
  const today = lagosDay(now());
  const sentToday = log.filter((l) => (l.status === "SENT" || l.status === "FAILED") && l.campaignId !== "TEST" && lagosDay(l.at) === today).length;
  return { campaigns: campaigns.map((c) => view(c, log)).reverse(), sentToday, dailyLimit: dailyLimit(), sender: emailProvider(), senderProblem: emailSetupProblem(), from: process.env.EMAIL_FROM || process.env.GMAIL_USER || "" };
}

// ───────────── sending ─────────────
const locks: Set<string> = ((globalThis as { __agraMailLocks?: Set<string> }).__agraMailLocks ??= new Set());

/** Sends the next few emails of a campaign. The page calls this again and again while it is open; safe to stop at any time. */
export async function sendBatch(campaignId: string, actor: string): Promise<ServiceResult<Record<string, unknown>>> {
  if (emailProvider() === "off") return fail(503, "Email is not set up on this server.");
  if (locks.has(campaignId)) return fail(409, "This message is already being sent from another window.");
  locks.add(campaignId);
  try {
    const repo = getRepository();
    const [campaigns, log] = await Promise.all([repo.getEmailCampaigns(), repo.getEmailLog()]);
    const c = campaigns.find((x) => x.campaignId === campaignId);
    if (!c) return fail(404, "Message not found.");
    const mine = log.filter((l) => l.campaignId === campaignId);
    if (mine.some((l) => l.status === "CANCELLED")) return { ok: true, status: 200, data: { done: true, stopped: "CANCELLED", progress: view(c, log) } };
    const today = lagosDay(now());
    const left = dailyLimit() - log.filter((l) => (l.status === "SENT" || l.status === "FAILED") && l.campaignId !== "TEST" && lagosDay(l.at) === today).length;
    const sent = new Set(mine.filter((l) => l.status === "SENT").map(logKey));
    const todo = c.recipientIds.filter((s) => !sent.has(keyOfStored(s)) && !gaveUp(mine, keyOfStored(s)));
    if (!todo.length) return { ok: true, status: 200, data: { done: true, progress: view(c, log) } };
    if (left <= 0) return { ok: true, status: 200, data: { done: false, stopped: "DAILY_LIMIT", progress: view(c, log) } };

    const { apps } = await rankedData();
    const { heading, body } = splitBody(c.body);
    const rows: EmailLogRow[] = []; let stopped: string | null = null;
    for (const stored of todo.slice(0, Math.min(BATCH, left))) {
      const who = fromStored(stored, apps);
      if (!who) { rows.push({ at: now(), campaignId, applicationId: stored, email: "", status: "FAILED", detail: "BAD_ADDRESS: application not found" }); continue; }
      const r = await sendEmail(render({ subject: c.subject, heading, body }, who, `${campaignId}-${who.key}`));
      rows.push({ at: now(), campaignId, applicationId: who.applicationId ?? "EXTERNAL", email: who.email, status: r.ok ? "SENT" : "FAILED", detail: r.ok ? (r.id ?? "") : r.reason });
      if (!r.ok && /DAILY_LIMIT|LOGIN_REJECTED|DOMAIN_NOT_VERIFIED|EMAIL_OFF/.test(r.reason)) { stopped = r.reason.split(":")[0]; break; }
      if (emailProvider() === "gmail") await new Promise((res) => setTimeout(res, 700));   // be gentle with Gmail
    }
    await repo.appendEmailLog(rows);   // one write for the whole batch
    const after = view(c, [...log, ...rows]);
    if (after.remaining === 0) await repo.logEvent({ at: now(), applicationId: "-", actor, action: "EMAIL_CAMPAIGN_FINISHED", detail: `${campaignId} | sent ${after.sent}, failed ${after.failed}` }).catch(() => {});
    return { ok: true, status: 200, data: { done: after.remaining === 0, stopped, progress: after } };
  } finally { locks.delete(campaignId); }
}

export async function cancelCampaign(campaignId: string, actor: string): Promise<ServiceResult<Record<string, unknown>>> {
  const c = (await getRepository().getEmailCampaigns()).find((x) => x.campaignId === campaignId);
  if (!c) return fail(404, "Message not found.");
  await getRepository().appendEmailLog([{ at: now(), campaignId, applicationId: "-", email: "", status: "CANCELLED", detail: `by ${actor}` }]);
  await getRepository().logEvent({ at: now(), applicationId: "-", actor, action: "EMAIL_CAMPAIGN_CANCELLED", detail: campaignId }).catch(() => {});
  return { ok: true, status: 200, data: { cancelled: true } };
}
