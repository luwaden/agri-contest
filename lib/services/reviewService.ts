import "server-only";
import { cache } from "react";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getRepository } from "@/lib/repository";
import { loadApplications } from "@/lib/data";
import { listStaff } from "@/lib/auth/users";
import { buildResults, checkScoreSheet, panelView, planAssignments, type Panelist } from "@/lib/judging";
import { isLiveReview, type PanelReview, type PanelRole } from "@/types/review";
import type { Application, ApplicationStatus } from "@/types/application";
import type { SessionUser } from "@/types/user";
import type { ServiceResult } from "./applicationService";

const newReviewId = () => `RV-${randomBytes(6).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
const now = () => new Date().toISOString();
const isPanel = (role: string): role is PanelRole => role === "JUDGE" || role === "REVIEWER";
const fail = (status: number, message: string, extra: Record<string, unknown> = {}) => ({ ok: false as const, status, body: { message, ...extra } });
const tabMissing = (e: unknown) => /parse range|Panel Reviews|not found/i.test(String((e as Error)?.message ?? e));
const TAB_MSG = 'The "Panel Reviews" tab does not exist yet. Run npm run setup:sheets once (it only adds that tab), then try again.';

/** Judges and reviewers who can be given work: active or invited (not deactivated). */
export async function listPanelists(): Promise<Panelist[]> {
  return (await listStaff()).filter((s) => isPanel(s.role) && (s.status === "active" || s.status === "invited"))
    .map((s) => ({ email: s.email.toLowerCase(), name: s.name, role: s.role as PanelRole }));
}

// ───────────── administrators ─────────────
const autoSchema = z.object({
  role: z.enum(["JUDGE", "REVIEWER"]),
  perApplication: z.coerce.number().int().min(1, "At least 1 per application.").max(10, "At most 10 per application."),
  statuses: z.array(z.enum(["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "FINALIST", "NOT_SELECTED", "WINNER"])).min(1, "Choose at least one application status."),
  valueChains: z.array(z.string().max(60)).max(30).default([]),
  states: z.array(z.string().max(60)).max(40).default([]),
  applicationIds: z.array(z.string().max(40)).max(500).default([]),
  dryRun: z.boolean().default(true),
});

/** Shares the chosen applications out evenly. dryRun (default) only returns the plan, so the admin sees it first. */
export async function autoAssign(input: unknown, actor: string): Promise<ServiceResult<Record<string, unknown>>> {
  const p = autoSchema.safeParse(input);
  if (!p.success) return fail(422, p.error.issues[0]?.message ?? "Please check the choices.");
  const o = p.data;
  const [{ applications }, panelists, existing] = await Promise.all([loadApplications(), listPanelists(), getRepository().getReviews()]);
  const pool = applications.filter((a) => (o.statuses as ApplicationStatus[]).includes(a.submissionStatus)
    && (!o.valueChains.length || o.valueChains.includes(a.business.valueChain)) && (!o.states.length || o.states.includes(a.location.state))
    && (!o.applicationIds.length || o.applicationIds.includes(a.applicationId)));
  const people = panelists.filter((x) => x.role === o.role);
  if (!people.length) return fail(422, `There are no ${o.role === "JUDGE" ? "judges" : "reviewers"} yet. Add them on the Staff page first.`);
  if (!pool.length) return fail(422, "No applications match those choices.");
  const plan = planAssignments({ applications: pool.map((a) => ({ applicationId: a.applicationId, applicantEmail: a.applicant.email })), panelists: people, existing, perApplication: o.perApplication, role: o.role });
  const summary = { pool: pool.length, people: people.length, creates: plan.create.length, shortfalls: plan.shortfalls, loadAfter: plan.loadAfter };
  if (o.dryRun || !plan.create.length) return { ok: true, status: 200, data: { ...summary, applied: false } };

  const at = now();
  const rows: PanelReview[] = plan.create.map((c) => ({ reviewId: newReviewId(), applicationId: c.applicationId, panelEmail: c.panelEmail, panelName: c.panelName, panelRole: o.role,
    status: "ASSIGNED", assignedAt: at, assignedBy: actor, scores: {}, comments: {}, overallComment: "", total: null, conflictNote: "", updatedAt: at, submittedAt: null, decision: null }));
  let added: number;
  try { added = await getRepository().createReviews(rows); } catch (e) { if (tabMissing(e)) return fail(409, TAB_MSG); throw e; }
  await getRepository().logEvent({ at, applicationId: "-", actor, action: "PANEL_AUTO_ASSIGNED", detail: `${added} ${o.role.toLowerCase()} assignment(s), ${o.perApplication} per application, ${pool.length} application(s)` });
  return { ok: true, status: 200, data: { ...summary, applied: true, added } };
}

const manualSchema = z.object({ applicationId: z.string().min(5).max(40), panelEmail: z.string().email().max(120).transform((s) => s.trim().toLowerCase()) });

export async function assignOne(input: unknown, actor: string): Promise<ServiceResult<{ review: PanelReview }>> {
  const p = manualSchema.safeParse(input);
  if (!p.success) return fail(422, "Choose an application and a panel member.");
  const { applicationId, panelEmail } = p.data; const repo = getRepository();
  const person = (await listPanelists()).find((x) => x.email === panelEmail);
  if (!person) return fail(422, "That person is not an active judge or reviewer.");
  const { applications } = await loadApplications(); const app = applications.find((a) => a.applicationId === applicationId);
  if (!app) return fail(404, "Application not found.");
  if (app.applicant.email.trim().toLowerCase() === panelEmail) return fail(422, "A person cannot review their own application.");
  const existing = (await repo.getReviews()).find((r) => r.applicationId === applicationId && r.panelEmail === panelEmail);
  if (existing?.status === "CONFLICT") return fail(409, `${person.name} declared a conflict of interest for this application, so it cannot be given to them.`);
  if (existing && existing.status !== "WITHDRAWN") return fail(409, `${person.name} already has this application.`);
  const at = now();
  let review: PanelReview | null;
  try {
    if (existing) review = await repo.updateReview(existing.reviewId, { status: "ASSIGNED", assignedAt: at, assignedBy: actor, panelRole: person.role, panelName: person.name });
    else {
      review = { reviewId: newReviewId(), applicationId, panelEmail, panelName: person.name, panelRole: person.role, status: "ASSIGNED", assignedAt: at, assignedBy: actor, scores: {}, comments: {}, overallComment: "", total: null, conflictNote: "", updatedAt: at, submittedAt: null, decision: null };
      await repo.createReviews([review]);
    }
  } catch (e) { if (tabMissing(e)) return fail(409, TAB_MSG); throw e; }
  await repo.logEvent({ at, applicationId, actor, action: "PANEL_ASSIGNED", detail: `${person.role} ${panelEmail}` });
  return { ok: true, status: 200, data: { review: review! } };
}

const changeSchema = z.object({ reviewId: z.string().min(4).max(40), action: z.enum(["withdraw", "reopen"]) });

/** withdraw = take an unfinished assignment away; reopen = let the person change a submitted score sheet. */
export async function changeReview(input: unknown, actor: string): Promise<ServiceResult<{ review: PanelReview }>> {
  const p = changeSchema.safeParse(input);
  if (!p.success) return fail(422, "Unknown change.");
  const repo = getRepository();
  const cur = (await repo.getReviews()).find((r) => r.reviewId === p.data.reviewId);
  if (!cur) return fail(404, "That assignment no longer exists.");
  let next: PanelReview | null;
  if (p.data.action === "withdraw") {
    if (cur.status === "SUBMITTED") return fail(409, "This score sheet has been submitted. Reopen it first if it must change; submitted scores are never deleted.");
    if (cur.status === "WITHDRAWN") return fail(409, "Already withdrawn.");
    next = await repo.updateReview(cur.reviewId, { status: "WITHDRAWN" });
  } else {
    if (cur.status !== "SUBMITTED") return fail(409, "Only a submitted score sheet can be reopened.");
    next = await repo.updateReview(cur.reviewId, { status: "IN_PROGRESS", total: null, submittedAt: null });
  }
  await repo.logEvent({ at: now(), applicationId: cur.applicationId, actor, action: p.data.action === "withdraw" ? "PANEL_WITHDRAWN" : "SCORE_REOPENED", detail: `${cur.panelRole} ${cur.panelEmail}` });
  return { ok: true, status: 200, data: { review: next! } };
}

/** Everything the Judging page needs, loaded ONCE per request (applications, reviews, people). With thousands of rows,
 *  loading the same sheet several times in parallel is slow and, in development mode, can overflow React's async tracing. */
export const judgingData = cache(async () => {
  const { applications } = await loadApplications();
  const reviews = await getRepository().getReviews();
  const panelists = await listPanelists();
  return { applications, reviews, panelists };
});

export async function overview() {
  const { applications, panelists, reviews } = await judgingData();
  const byPerson = panelists.map((p) => {
    const mine = reviews.filter((r) => r.panelEmail === p.email && r.panelRole === p.role);
    const count = (s: PanelReview["status"]) => mine.filter((r) => r.status === s).length;
    return { ...p, assigned: mine.filter(isLiveReview).length, notStarted: count("ASSIGNED"), inProgress: count("IN_PROGRESS"), submitted: count("SUBMITTED"), conflicts: count("CONFLICT") };
  });
  const ids = new Set(reviews.filter((r) => r.status === "CONFLICT").map((r) => r.applicationId));
  const names = new Map(applications.filter((a) => ids.has(a.applicationId)).map((a) => [a.applicationId, a.business.businessName]));
  const conflicts = reviews.filter((r) => r.status === "CONFLICT").map((r) => ({ ...r, businessName: names.get(r.applicationId) ?? "" }));
  return { panelists, reviews, byPerson, conflicts };
}

export async function results(role: PanelRole) {
  const { applications, reviews } = await judgingData();
  return buildResults(applications, reviews, role);
}
export const reviewsForApplication = async (id: string) => (await getRepository().getReviews()).filter((r) => r.applicationId === id);

// ───────────── judges and reviewers ─────────────
/** A panel member's own work list. Only their rows, joined to the business details they need for filtering. */
export async function myWork(user: SessionUser) {
  if (!isPanel(user.role)) return [];
  const [{ applications }, reviews] = await Promise.all([loadApplications(), getRepository().getReviews()]);
  const apps = new Map(applications.map((a) => [a.applicationId, a]));
  return reviews.filter((r) => r.panelEmail === user.email.toLowerCase() && r.panelRole === user.role && r.status !== "WITHDRAWN")
    .flatMap((r) => { const a = apps.get(r.applicationId); return a ? [{ review: stripForOwner(r), app: listItem(a) }] : []; });
}
const listItem = (a: Application) => ({ applicationId: a.applicationId, businessName: a.business.businessName, valueChain: a.business.valueChain, state: a.location.state, stage: a.business.stage, setting: a.business.setting, generatesRevenue: a.business.generatesRevenue });
export type WorkItem = Awaited<ReturnType<typeof myWork>>[number];
/** Never send who else is on the panel or what they scored. The person's own row is all they get. */
const stripForOwner = (r: PanelReview) => ({ reviewId: r.reviewId, status: r.status, assignedAt: r.assignedAt, scores: r.scores, comments: r.comments, overallComment: r.overallComment, total: r.total, conflictNote: r.conflictNote, updatedAt: r.updatedAt, submittedAt: r.submittedAt, decision: r.decision });
export type OwnReview = ReturnType<typeof stripForOwner>;

async function ownRow(user: SessionUser, applicationId: string) {
  if (!isPanel(user.role)) return null;
  return (await getRepository().getReviews()).find((r) => r.applicationId === applicationId && r.panelEmail === user.email.toLowerCase() && r.panelRole === user.role && r.status !== "WITHDRAWN") ?? null;
}

/** The score-sheet page. null = not assigned to this person (the page then shows "not found", revealing nothing). */
export async function openForScoring(user: SessionUser, applicationId: string) {
  const row = await ownRow(user, applicationId); if (!row) return null;
  const { applications } = await loadApplications(); const a = applications.find((x) => x.applicationId === applicationId);
  if (!a) return null;
  const order = (await myWork(user)).map((w) => w.app.applicationId);
  return { review: stripForOwner(row), application: panelView(a), position: { index: order.indexOf(applicationId), ids: order } };
}

export async function saveScoreSheet(user: SessionUser, applicationId: string, input: Record<string, unknown>): Promise<ServiceResult<{ review: OwnReview }>> {
  const row = await ownRow(user, applicationId);
  if (!row) return fail(404, "This application is not assigned to you.");
  if (row.status === "SUBMITTED") return fail(409, "You have already submitted this score sheet. Ask the programme team to reopen it if something must change.");
  if (row.status === "CONFLICT") return fail(409, "You declared a conflict of interest for this application, so it cannot be scored by you.");
  const submit = input.submit === true;
  const c = checkScoreSheet(input, submit);
  if (!c.ok) return fail(422, submit ? "Please complete the highlighted parts before submitting." : "Please fix the highlighted parts.", { errors: c.errors });
  const at = now();
  const next = await getRepository().updateReview(row.reviewId, { scores: c.scores, comments: c.comments, overallComment: c.overallComment, status: submit ? "SUBMITTED" : "IN_PROGRESS", total: submit ? c.total : null, submittedAt: submit ? at : null, updatedAt: at });
  if (submit) await getRepository().logEvent({ at, applicationId, actor: user.email, action: "SCORE_SUBMITTED", detail: `${user.role} total ${c.total}` });
  return { ok: true, status: 200, data: { review: stripForOwner(next!) } };
}

export async function declareConflict(user: SessionUser, applicationId: string, input: Record<string, unknown>): Promise<ServiceResult<{ review: OwnReview }>> {
  const row = await ownRow(user, applicationId);
  if (!row) return fail(404, "This application is not assigned to you.");
  if (row.status === "SUBMITTED") return fail(409, "This score sheet was already submitted. Contact the programme team about the conflict straight away.");
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 500) : "";
  if (note.length < 5) return fail(422, "Please say briefly what the relationship is (for example: \"former colleague\"). Only the programme team sees this.", { errors: { note: "Please describe the relationship briefly." } });
  const at = now();
  const next = await getRepository().updateReview(row.reviewId, { status: "CONFLICT", conflictNote: note, scores: {}, comments: {}, overallComment: "", total: null, submittedAt: null, updatedAt: at, decision: null });
  await getRepository().logEvent({ at, applicationId, actor: user.email, action: "CONFLICT_DECLARED", detail: `${user.role}: ${note.slice(0, 120)}` });
  return { ok: true, status: 200, data: { review: stripForOwner(next!) } };
}

/** Uploaded files: a panel member may open a document only if it belongs to an application assigned to them. */
export async function panelMayOpenFile(user: SessionUser, url: string) {
  if (!isPanel(user.role)) return false;
  const ids = new Set((await getRepository().getReviews()).filter((r) => r.panelEmail === user.email.toLowerCase() && r.panelRole === user.role && isLiveReview(r)).map((r) => r.applicationId));
  if (!ids.size) return false;
  const { applications } = await loadApplications();
  return applications.some((a) => ids.has(a.applicationId) && a.documents.some((d) => d.url === url));
}
