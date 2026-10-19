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
export const audienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("batch") }),                                       // with screening reviewers
  z.object({ kind: z.literal("passed") }),                                      // passed by a reviewer
  z.object({ kind: z.literal("judges") }),                                      // with judges
  z.object({ kind: z.literal("finalists"), n: z.coerce.number().int().min(1).max(500).default(30) }),   // top N by judges' average
  z.object({ kind: z.literal("top"), n: z.coerce.number().int().min(1).max(MAX_RECIPIENTS) }),           // top N eligible by pre-score
  z.object({ kind: z.literal("status"), status: z.enum(["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "NOT_SELECTED", "FINALIST", "WINNER"]) }),
  z.object({ kind: z.literal("list"), spec: listSpecSchema }),                  // a list built under Screening → Quick requests
  z.object({ kind: z.literal("pasted"), text: z.string().max(200_000) }),       // references and/or email addresses
]);
export type Audience = z.infer<typeof audienceSchema>;

async function resolve(aud: Audience): Promise<{ apps: Application[]; label: string; notFound: string[] }> {
  const d = await rankedData();
  const live = (role: "REVIEWER" | "JUDGE", passedOnly = false) => new Set(d.reviews.filter((r) => r.panelRole === role && isLiveReview(r) && (!passedOnly || r.decision === "PASS")).map((r) => r.applicationId));
  const pick = (ids: Iterable<string>) => [...ids].map((id) => d.apps.get(id)).filter((a): a is Application => !!a);
  let apps: Application[] = [], label = "", notFound: string[] = [];
  switch (aud.kind) {
    case "batch": apps = pick(live("REVIEWER")); label = "Applications with screening reviewers"; break;
    case "passed": apps = pick(live("REVIEWER", true)); label = "Passed by reviewers"; break;
    case "judges": apps = pick(live("JUDGE")); label = "Applications with judges"; break;
    case "finalists": apps = pick(buildResults(d.applications, d.reviews, "JUDGE").filter((r) => r.average !== null).slice(0, aud.n).map((r) => r.applicationId)); label = `Top ${aud.n} by judges' scores`; break;
    case "top": apps = pick(d.ranked.slice(0, aud.n).map((p) => p.applicationId)); label = `Top ${aud.n} eligible by pre-score`; break;
    case "status": apps = d.applications.filter((a) => a.submissionStatus === (aud.status as ApplicationStatus)); label = `Status: ${aud.status}`; break;
    case "list": apps = pick(buildList(d.ranked, d.applications, aud.spec).rows.map((r) => r.applicationId)); label = `Custom list (${aud.spec.size})`; break;
    case "pasted": {
      const tokens = [...new Set(aud.text.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))];
      const byEmail = new Map(d.applications.map((a) => [a.applicant.email.trim().toLowerCase(), a]));
      for (const t of tokens) { const a = d.apps.get(t.toUpperCase()) ?? byEmail.get(t.toLowerCase()); if (a) apps.push(a); else notFound.push(t); }
      label = "Pasted list"; break;
    }
  }
  // Submitted applications only, one per email address.
  const seen = new Set<string>();
  apps = apps.filter((a) => { const e = a.applicant.email.trim().toLowerCase(); if (a.submissionStatus === "DRAFT" || !e || seen.has(e)) return false; seen.add(e); return true; });
  return { apps, label: `${label} (${apps.length})`, notFound: notFound.slice(0, 50) };
}

// ───────────── the message ─────────────
export const FILL_INS = { first_name: "First name", last_name: "Surname", full_name: "Full name", application_id: "Reference number", business_name: "Business name", state: "State" } as const;
const fillIn = (a: Application, key: string): string => ({
  first_name: a.applicant.firstName.trim() || "applicant", last_name: a.applicant.lastName.trim(), full_name: `${a.applicant.firstName} ${a.applicant.lastName}`.replace(/\s+/g, " ").trim(),
  application_id: a.applicationId, business_name: a.business.businessName.trim(), state: a.location.state,
} as Record<string, string>)[key] ?? "";
const fill = (t: string, a: Application) => t.replace(/\{(\w+)\}/g, (m, k) => (k in FILL_INS ? fillIn(a, k) : m));
export function unknownFillIns(...texts: string[]) { return [...new Set(texts.flatMap((t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1])).filter((k) => !(k in FILL_INS)))]; }

const messageSchema = z.object({
  subject: z.string().trim().min(3, "Write a subject.").max(150),
  heading: z.string().trim().max(120).default(""),
  body: z.string().trim().min(10, "Write the message.").max(8000),
});
const composeSchema = messageSchema.extend({ audience: audienceSchema });

function render(m: z.infer<typeof messageSchema>, a: Application, key: string) {
  return teamMessage({ to: a.applicant.email.trim(), subject: fill(m.subject, a), heading: fill(m.heading || m.subject, a), body: fill(m.body, a), ref: a.applicationId, key });
}

export async function preview(input: unknown): Promise<ServiceResult<Record<string, unknown>>> {
  const p = composeSchema.safeParse(input);
  if (!p.success) return fail(422, p.error.issues[0]?.message ?? "Please check the message.");
  const bad = unknownFillIns(p.data.subject, p.data.heading, p.data.body);
  if (bad.length) return fail(422, `Unknown fill-in: {${bad.join("}, {")}}. You can use: ${Object.keys(FILL_INS).map((k) => `{${k}}`).join(", ")}.`);
  const r = await resolve(p.data.audience);
  if (r.apps.length > MAX_RECIPIENTS) return fail(422, `That is ${r.apps.length} people. One message can go to at most ${MAX_RECIPIENTS}; split the group.`);
  const first = r.apps[0];
  return { ok: true, status: 200, data: {
    count: r.apps.length, label: r.label, notFound: r.notFound,
    sample: r.apps.slice(0, 8).map((a) => ({ applicationId: a.applicationId, name: fillIn(a, "full_name"), email: a.applicant.email })),
    email: first ? (({ subject, html, text }) => ({ subject, html, text, to: first.applicant.email }))(render(p.data, first, "preview")) : null,
    sender: emailProvider(), senderProblem: emailSetupProblem(), dailyLimit: dailyLimit(),
  } };
}

/** Sends the message, filled in for the first recipient, to the signed-in administrator only. */
export async function sendTest(input: unknown, me: string): Promise<ServiceResult<Record<string, unknown>>> {
  const p = composeSchema.safeParse(input);
  if (!p.success) return fail(422, p.error.issues[0]?.message ?? "Please check the message.");
  if (emailProvider() === "off") return fail(503, "Email is not set up on this server (GMAIL_USER and GMAIL_APP_PASSWORD).");
  const r = await resolve(p.data.audience);
  if (!r.apps.length) return fail(422, "Nobody is in that group, so there is nothing to fill in.");
  const msg = render(p.data, r.apps[0], `test-${randomBytes(6).toString("hex")}`);
  const sent = await sendEmail({ ...msg, to: me, subject: `[TEST] ${msg.subject}` });
  await getRepository().appendEmailLog([{ at: now(), campaignId: "TEST", applicationId: r.apps[0].applicationId, email: me, status: "TEST", detail: sent.ok ? "sent to the administrator" : sent.reason }]).catch(() => {});
  return sent.ok ? { ok: true, status: 200, data: { sentTo: me } } : fail(502, `The test was not sent: ${sent.reason}`);
}

export async function createCampaign(input: unknown, actor: string): Promise<ServiceResult<{ campaign: CampaignView }>> {
  const p = composeSchema.safeParse(input);
  if (!p.success) return fail(422, p.error.issues[0]?.message ?? "Please check the message.");
  const bad = unknownFillIns(p.data.subject, p.data.heading, p.data.body);
  if (bad.length) return fail(422, `Unknown fill-in: {${bad.join("}, {")}}.`);
  if (emailProvider() === "off") return fail(503, "Email is not set up on this server (GMAIL_USER and GMAIL_APP_PASSWORD).");
  const r = await resolve(p.data.audience);
  if (!r.apps.length) return fail(422, "Nobody is in that group.");
  if (r.apps.length > MAX_RECIPIENTS) return fail(422, `At most ${MAX_RECIPIENTS} people per message; split the group.`);
  // The heading travels inside the stored body so the Email Campaigns tab keeps its 7 columns.
  const c: EmailCampaign = { campaignId: `MSG-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`, createdAt: now(), createdBy: actor,
    subject: p.data.subject, body: p.data.heading ? `#${p.data.heading}\n${p.data.body}` : p.data.body, audience: r.label, recipientIds: r.apps.map((a) => a.applicationId) };
  await getRepository().createEmailCampaign(c);
  await getRepository().logEvent({ at: c.createdAt, applicationId: "-", actor, action: "EMAIL_CAMPAIGN_CREATED", detail: `${c.campaignId} | ${c.audience} | ${c.subject}`.slice(0, 480) });
  return { ok: true, status: 200, data: { campaign: view(c, []) } };
}
const splitBody = (body: string) => (body.startsWith("#") ? { heading: body.slice(1, body.indexOf("\n") === -1 ? undefined : body.indexOf("\n")), body: body.indexOf("\n") === -1 ? "" : body.slice(body.indexOf("\n") + 1) } : { heading: "", body });

// ───────────── progress ─────────────
export interface CampaignView { campaignId: string; createdAt: string; createdBy: string; subject: string; audience: string; total: number; sent: number; failed: number; remaining: number; cancelled: boolean; lastErrors: string[] }
function view(c: EmailCampaign, log: EmailLogRow[]): CampaignView {
  const mine = log.filter((l) => l.campaignId === c.campaignId);
  const sent = new Set(mine.filter((l) => l.status === "SENT").map((l) => l.applicationId));
  const failedIds = new Set(mine.filter((l) => l.status === "FAILED" && !sent.has(l.applicationId)).map((l) => l.applicationId));
  return { campaignId: c.campaignId, createdAt: c.createdAt, createdBy: c.createdBy, subject: c.subject, audience: c.audience, total: c.recipientIds.length,
    sent: sent.size, failed: failedIds.size, remaining: c.recipientIds.filter((id) => !sent.has(id) && !gaveUp(mine, id)).length,
    cancelled: mine.some((l) => l.status === "CANCELLED"), lastErrors: [...new Set(mine.filter((l) => l.status === "FAILED").slice(-5).map((l) => l.detail.slice(0, 120)))] };
}
/** A bad address is never retried; any other failure is retried up to 3 attempts in all. */
const gaveUp = (mine: EmailLogRow[], id: string) => { const f = mine.filter((l) => l.applicationId === id && l.status === "FAILED"); return f.some((l) => /BAD_ADDRESS/.test(l.detail)) || f.length >= 3; };

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
    const sent = new Set(mine.filter((l) => l.status === "SENT").map((l) => l.applicationId));
    const todo = c.recipientIds.filter((id) => !sent.has(id) && !gaveUp(mine, id));
    if (!todo.length) return { ok: true, status: 200, data: { done: true, progress: view(c, log) } };
    if (left <= 0) return { ok: true, status: 200, data: { done: false, stopped: "DAILY_LIMIT", progress: view(c, log) } };

    const { apps } = await rankedData();
    const { heading, body } = splitBody(c.body);
    const rows: EmailLogRow[] = []; let stopped: string | null = null;
    for (const id of todo.slice(0, Math.min(BATCH, left))) {
      const a = apps.get(id);
      if (!a) { rows.push({ at: now(), campaignId, applicationId: id, email: "", status: "FAILED", detail: "BAD_ADDRESS: application not found" }); continue; }
      const r = await sendEmail(render({ subject: c.subject, heading, body }, a, `${campaignId}-${id}`));
      rows.push({ at: now(), campaignId, applicationId: id, email: a.applicant.email.trim(), status: r.ok ? "SENT" : "FAILED", detail: r.ok ? (r.id ?? "") : r.reason });
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
