import "server-only";
import { randomBytes } from "node:crypto";
import { getRepository } from "@/lib/repository";
import { loadStaff } from "@/lib/auth/users";
import { csvCell } from "@/lib/csv";
import { OFF_MESSAGE, featureOn } from "@/lib/features";
import { L2_CRITERIA, L2_CRITERION_IDS, L2_DECISIONS, L2_LEGACY_MAX, L2_MAX_MARKS, L2_TOP_PICKS, l2Percent } from "@/config/level2Review";
import { L2_DOC_FIELDS } from "@/lib/validation/level2";
import { isLegacyL2Review, isLiveL2Review, type Level2Application, type Level2Review } from "@/types/level2";
import { level2Documents } from "./level2Service";
import type { SessionUser } from "@/types/user";
import type { ServiceResult } from "./applicationService";

/**
 * LEVEL 2 REVIEW
 *
 *   admin: share unassigned Level 2 applicants evenly between chosen reviewers (preview → confirm), then move single ones
 *   reviewer: sees only their own applicants; marks the sheet in config/level2Review.ts (out of 80, shown as %),
 *             Recommend / Do not recommend, short comment; then picks a top 3 with a reason for each
 *
 * One live review per applicant. Moving withdraws the old row (kept for the record) and adds a new one.
 * A submitted review never moves; an administrator can reopen it.
 */
const fail = (status: number, message: string, extra: Record<string, unknown> = {}) => ({ ok: false as const, status, body: { message, ...extra } });
const now = () => new Date().toISOString();
const newId = () => `L2R-${randomBytes(5).toString("hex").toUpperCase()}`;
const lc = (s: string) => s.trim().toLowerCase();

export interface Reviewer { email: string; name: string; role: string; assigned: number; done: number }

async function load() {
  const repo = getRepository();
  const [subs, reviews, staff] = await Promise.all([repo.getLevel2Applications(), repo.getLevel2Reviews(), loadStaff()]);
  const live = new Map<string, Level2Review>();
  for (const r of reviews) if (isLiveL2Review(r)) live.set(r.level1Code, r);
  const reviewers: Reviewer[] = staff.accounts.filter((a) => a.active && (a.role === "REVIEWER" || a.role === "JUDGE"))
    .map((a) => ({ email: lc(a.email), name: a.name, role: a.role, assigned: 0, done: 0 }));
  const byEmail = new Map(reviewers.map((r) => [r.email, r]));
  for (const r of live.values()) { const p = byEmail.get(r.reviewerEmail); if (p) { p.assigned++; if (r.status === "SUBMITTED") p.done++; } }
  return { subs, reviews, live, reviewers, byEmail };
}

// ───────────── administrators ─────────────
export async function level2ReviewOverview() {
  const { subs, live, reviewers } = await load();
  const rows = [...subs].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).map((s) => {
    const r = live.get(s.level1Code);
    return { code: s.level1Code, businessName: s.businessName, state: s.state, contactName: s.contactName, submittedAt: s.submittedAt,
      review: r ? { reviewId: r.reviewId, reviewerEmail: r.reviewerEmail, reviewerName: r.reviewerName, status: r.status, total: r.total, percent: r.percent, decision: r.decision,
        topRank: r.topRank, legacyTotal: isLegacyL2Review(r) ? r.legacy!.total : null, updatedAt: r.updatedAt } : null };
  });
  const reviewed = rows.filter((r) => r.review?.status === "SUBMITTED");
  return {
    rows, reviewers, maxTotal: L2_MAX_MARKS, legacyMax: L2_LEGACY_MAX,
    stats: { submitted: rows.length, assigned: rows.filter((r) => r.review).length, reviewed: reviewed.length, recommended: reviewed.filter((r) => r.review!.decision === "RECOMMEND").length },
  };
}

/** Who gets which unassigned applicant. Always the reviewer with the fewest live applicants next; sorting by state first spreads each state across reviewers. */
function plan(subs: Level2Application[], live: Map<string, Level2Review>, chosen: Reviewer[], byState: boolean) {
  const todo = subs.filter((s) => !live.has(s.level1Code))
    .sort((a, b) => (byState ? a.state.localeCompare(b.state) : 0) || a.submittedAt.localeCompare(b.submittedAt));
  const load = new Map(chosen.map((r) => [r.email, r.assigned]));
  const out: Array<{ code: string; email: string }> = [];
  for (const s of todo) {
    let pick = chosen[0];
    for (const r of chosen) if (load.get(r.email)! < load.get(pick.email)!) pick = r;
    load.set(pick.email, load.get(pick.email)! + 1); out.push({ code: s.level1Code, email: pick.email });
  }
  return out;
}

function chosenReviewers(emails: unknown, byEmail: Map<string, Reviewer>) {
  const list = Array.isArray(emails) ? [...new Set(emails.filter((e): e is string => typeof e === "string").map(lc))] : [];
  const found = list.map((e) => byEmail.get(e)).filter((r): r is Reviewer => !!r);
  return { found, unknown: list.filter((e) => !byEmail.has(e)) };
}

/** { reviewers: [emails], byState } → the planned counts. Nothing is saved. */
export async function previewShare(input: { reviewers?: unknown; byState?: unknown }): Promise<ServiceResult<Record<string, unknown>>> {
  const { subs, live, byEmail } = await load();
  const { found, unknown } = chosenReviewers(input.reviewers, byEmail);
  if (unknown.length) return fail(422, `Not an active reviewer account: ${unknown.join(", ")}.`);
  if (!found.length) return fail(422, "Tick at least one reviewer.");
  const p = plan(subs, live, found, input.byState === true);
  return { ok: true, status: 200, data: { total: p.length, perReviewer: found.map((r) => ({ email: r.email, name: r.name, adding: p.filter((x) => x.email === r.email).length, alreadyHas: r.assigned })) } };
}

export async function confirmShare(input: { reviewers?: unknown; byState?: unknown }, actor: string): Promise<ServiceResult<{ added: number }>> {
  const { subs, live, byEmail } = await load();
  const { found, unknown } = chosenReviewers(input.reviewers, byEmail);
  if (unknown.length) return fail(422, `Not an active reviewer account: ${unknown.join(", ")}.`);
  if (!found.length) return fail(422, "Tick at least one reviewer.");
  const p = plan(subs, live, found, input.byState === true);
  if (!p.length) return fail(422, "Every Level 2 applicant already has a reviewer.");
  const at = now();
  const added = await getRepository().createLevel2Reviews(p.map(({ code, email }) => newRow(code, byEmail.get(email)!, actor, at)));
  await getRepository().logEvent({ at, applicationId: "-", actor, action: "LEVEL2_REVIEWS_SHARED", detail: `${added} applicant(s) between ${found.map((r) => r.email).join(", ")}`.slice(0, 480) }).catch(() => {});
  return { ok: true, status: 200, data: { added } };
}

const newRow = (code: string, r: Reviewer, actor: string, at: string): Level2Review => ({
  reviewId: newId(), level1Code: code, reviewerEmail: r.email, reviewerName: r.name, status: "ASSIGNED", assignedAt: at, assignedBy: actor,
  scores: {}, total: null, percent: null, decision: null, comment: "", updatedAt: at, submittedAt: null, topRank: null, topReason: "", legacy: null,
});
const codesOf = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((c): c is string => typeof c === "string").map((c) => c.trim().toUpperCase()))].slice(0, 2000) : []);

/** Give the chosen applicants to one reviewer (also assigns ones that have nobody yet). Submitted reviews never move. */
export async function moveTo(input: { codes?: unknown; to?: unknown }, actor: string): Promise<ServiceResult<{ moved: number; skipped: string[] }>> {
  const { subs, live, byEmail } = await load();
  const to = byEmail.get(lc(String(input.to ?? "")));
  if (!to) return fail(422, "Choose a reviewer.");
  const known = new Set(subs.map((s) => s.level1Code));
  const codes = codesOf(input.codes).filter((c) => known.has(c));
  if (!codes.length) return fail(422, "Tick at least one applicant.");
  const skipped: string[] = [], withdraw: string[] = [], add: string[] = [];
  for (const c of codes) {
    const r = live.get(c);
    if (r?.status === "SUBMITTED") { skipped.push(`${c} (already reviewed)`); continue; }
    if (r?.reviewerEmail === to.email) continue;
    if (r) withdraw.push(r.reviewId);
    add.push(c);
  }
  const at = now(); const repo = getRepository();
  if (withdraw.length) await repo.updateLevel2Reviews(withdraw.map((reviewId) => ({ reviewId, patch: { status: "WITHDRAWN", updatedAt: at } })));
  const moved = add.length ? await repo.createLevel2Reviews(add.map((c) => newRow(c, to, actor, at))) : 0;
  if (moved) await repo.logEvent({ at, applicationId: add.length === 1 ? add[0] : "-", actor, action: "LEVEL2_REVIEWS_MOVED", detail: `${moved} to ${to.email}: ${add.join(", ")}`.slice(0, 480) }).catch(() => {});
  return { ok: true, status: 200, data: { moved, skipped } };
}

/** Take applicants away from their reviewer (not once submitted). */
export async function unassign(input: { codes?: unknown }, actor: string): Promise<ServiceResult<{ removed: number; skipped: string[] }>> {
  const { live } = await load();
  const skipped: string[] = [], ids: string[] = [];
  for (const c of codesOf(input.codes)) { const r = live.get(c); if (!r) continue; if (r.status === "SUBMITTED") skipped.push(`${c} (already reviewed)`); else ids.push(r.reviewId); }
  const at = now();
  if (ids.length) {
    await getRepository().updateLevel2Reviews(ids.map((reviewId) => ({ reviewId, patch: { status: "WITHDRAWN", updatedAt: at } })));
    await getRepository().logEvent({ at, applicationId: "-", actor, action: "LEVEL2_REVIEWS_REMOVED", detail: `${ids.length} review(s) withdrawn` }).catch(() => {});
  }
  return { ok: true, status: 200, data: { removed: ids.length, skipped } };
}

/** Lets the reviewer change a submitted review again. */
export async function reopen(input: { code?: unknown }, actor: string): Promise<ServiceResult<{ reopened: boolean }>> {
  const { live } = await load();
  const r = live.get(String(input.code ?? "").trim().toUpperCase());
  if (!r || r.status !== "SUBMITTED") return fail(422, "Only a submitted review can be reopened.");
  await getRepository().updateLevel2Reviews([{ reviewId: r.reviewId, patch: { status: "IN_PROGRESS", submittedAt: null } }]);
  await getRepository().logEvent({ at: now(), applicationId: r.level1Code, actor, action: "LEVEL2_REVIEW_REOPENED", detail: `review by ${r.reviewerEmail}` }).catch(() => {});
  return { ok: true, status: 200, data: { reopened: true } };
}

/** The live review for one applicant (admin detail page). */
export async function reviewFor(code: string) { return (await getRepository().getLevel2Reviews()).find((r) => r.level1Code === code && isLiveL2Review(r)) ?? null; }

export async function level2ReviewCsv() {
  const { rows } = await level2ReviewOverview();
  const all = new Map((await getRepository().getLevel2Reviews()).filter(isLiveL2Review).map((r) => [r.level1Code, r]));
  const head = ["level1_code", "business_name", "state", "contact_name", "reviewer", "status", ...L2_CRITERIA.map((c) => `${c.label} (/${c.max})`),
    `marks_out_of_${L2_MAX_MARKS}`, "percent", "decision", "comment", "top_3_rank", "top_3_reason", `earlier_form_out_of_${L2_LEGACY_MAX}`, "submitted_at"];
  const lines = [head, ...rows.map((x) => { const r = all.get(x.code); return [x.code, x.businessName, x.state, x.contactName, r?.reviewerName || r?.reviewerEmail || "", r?.status ?? "NOT_ASSIGNED",
    ...L2_CRITERION_IDS.map((id) => (r && Number.isInteger(r.scores[id]) ? String(r.scores[id]) : "")), r?.total == null ? "" : String(r.total), r?.percent == null ? "" : String(r.percent),
    r?.decision ? L2_DECISIONS.find((d) => d.value === r.decision)!.label : "", r?.comment ?? "", r?.topRank == null ? "" : String(r.topRank), r?.topReason ?? "",
    r && isLegacyL2Review(r) ? String(r.legacy!.total) : "", r?.submittedAt ?? ""]; })];
  return { rows: rows.length, csv: "\uFEFF" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n" };
}

/** Admin → Level 2: each applicant's result, and every reviewer's top 3 with their reasons. */
export async function level2Results() {
  const { subs, live, reviewers } = await load();
  const byCode = new Map(subs.map((s) => [s.level1Code, s]));
  const results: Record<string, { percent: number | null; status: Level2Review["status"]; decision: Level2Review["decision"]; reviewerName: string; topRank: number | null; legacy: boolean }> = {};
  for (const r of live.values()) if (byCode.has(r.level1Code))
    results[r.level1Code] = { percent: r.status === "SUBMITTED" ? r.percent : null, status: r.status, decision: r.status === "SUBMITTED" ? r.decision : null, reviewerName: r.reviewerName || r.reviewerEmail, topRank: r.topRank, legacy: isLegacyL2Review(r) };
  const picks = reviewers.filter((p) => p.assigned > 0).map((p) => ({
    email: p.email, name: p.name, assigned: p.assigned, done: p.done,
    top: [...live.values()].filter((r) => r.reviewerEmail === p.email && r.topRank !== null && byCode.has(r.level1Code)).sort((a, b) => a.topRank! - b.topRank!)
      .map((r) => ({ rank: r.topRank!, code: r.level1Code, businessName: byCode.get(r.level1Code)!.businessName, state: byCode.get(r.level1Code)!.state, percent: r.percent, decision: r.decision, reason: r.topReason, reopened: r.status !== "SUBMITTED" })),
  }));
  return { results, picks, required: L2_TOP_PICKS };
}

// ───────────── reviewers ─────────────
const isPanel = (u: SessionUser) => u.role === "REVIEWER" || u.role === "JUDGE";

export async function myLevel2Reviews(user: SessionUser) {
  if (!isPanel(user)) return [];
  const repo = getRepository();
  const [reviews, subs] = await Promise.all([repo.getLevel2Reviews(), repo.getLevel2Applications()]);
  const byCode = new Map(subs.map((s) => [s.level1Code, s]));
  const order = { ASSIGNED: 0, IN_PROGRESS: 1, SUBMITTED: 2, WITHDRAWN: 3 } as const;
  return reviews.filter((r) => isLiveL2Review(r) && r.reviewerEmail === lc(user.email) && byCode.has(r.level1Code))
    .map((r) => ({ review: r, submission: byCode.get(r.level1Code)! }))
    .sort((a, b) => order[a.review.status] - order[b.review.status] || a.review.assignedAt.localeCompare(b.review.assignedAt));
}

/** The applicant and the reviewer's own review, only if it is assigned to them. */
export async function myLevel2Review(user: SessionUser, code: string) {
  const c = code.trim().toUpperCase();
  return (await myLevel2Reviews(user)).find((x) => x.submission.level1Code === c) ?? null;
}

export type ReviewErrors = Record<string, string>;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v : "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);

/** Which "document submitted" criteria have no document: those are always 0. */
export function missingDocCriteria(s: Level2Application) {
  const provided = new Set(level2Documents(s).filter((d) => d.status !== "missing").map((d) => d.field));
  return new Set(L2_CRITERIA.filter((c) => c.doc && !provided.has(c.doc)).map((c) => c.id));
}

/** { scores: {id: 0..max}, decision, comment } saved as a draft, or { …, submit: true } checked and locked. */
export async function saveMyLevel2Review(user: SessionUser, code: string, body: Record<string, unknown>): Promise<ServiceResult<{ review: Level2Review }>> {
  if (!(await featureOn("level2Scoring"))) return fail(503, OFF_MESSAGE.level2Scoring, { code: "FEATURE_OFF" });
  const mine = await myLevel2Review(user, code);
  if (!mine) return fail(404, "This applicant is not assigned to you.");
  if (mine.review.status === "SUBMITTED" && !isLegacyL2Review(mine.review)) return fail(409, "You have already submitted this review. Ask the programme team if it needs to change.");
  const raw = (body.scores && typeof body.scores === "object" ? body.scores : {}) as Record<string, unknown>;
  const noDoc = missingDocCriteria(mine.submission);
  const scores: Record<string, number> = {};
  for (const c of L2_CRITERIA) {
    if (noDoc.has(c.id)) { scores[c.id] = 0; continue; }   // not submitted = no marks, whatever was sent
    const v = raw[c.id] === "" || raw[c.id] == null ? NaN : Number(raw[c.id]);
    if (Number.isInteger(v) && v >= 0 && v <= c.max) scores[c.id] = v;
  }
  const decision = body.decision === "RECOMMEND" || body.decision === "NOT_RECOMMEND" ? body.decision : null;
  const comment = clean(body.comment, 1000);
  const submit = body.submit === true;
  if (submit) {
    const errors: ReviewErrors = {};
    for (const c of L2_CRITERIA) if (scores[c.id] === undefined) errors[c.id] = `Give a mark from 0 to ${c.max}.`;
    if (!decision) errors.decision = "Choose Recommend or Do not recommend.";
    if (comment.length < 10) errors.comment = "Write a short reason (a sentence is enough).";
    if (Object.keys(errors).length) return fail(422, "A few marks are missing.", { errors });
  }
  const complete = L2_CRITERION_IDS.every((id) => scores[id] !== undefined);
  const total = complete ? L2_CRITERION_IDS.reduce((n, id) => n + scores[id], 0) : null;
  const at = now();
  const [review] = await getRepository().updateLevel2Reviews([{ reviewId: mine.review.reviewId, patch: {
    scores, decision, comment, total, percent: total === null ? null : l2Percent(total),
    status: submit ? "SUBMITTED" : "IN_PROGRESS", submittedAt: submit ? at : null, updatedAt: at } }]);
  if (submit) await getRepository().logEvent({ at, applicationId: mine.review.level1Code, actor: user.email, action: "LEVEL2_REVIEW_SUBMITTED", detail: `${review.total}/${L2_MAX_MARKS} (${review.percent}%) ${review.decision}` }).catch(() => {});
  return { ok: true, status: 200, data: { review } };
}

/** How many top picks this reviewer must give: 3, or all of theirs if they have fewer than 3 applicants. */
export const topPicksNeeded = (assigned: number) => Math.min(L2_TOP_PICKS, assigned);

/** { picks: [{ code, reason }, …] } in rank order (first = best). Only applicants this reviewer has submitted on the current sheet. */
export async function saveMyTopPicks(user: SessionUser, body: Record<string, unknown>): Promise<ServiceResult<{ saved: number }>> {
  if (!(await featureOn("level2Scoring"))) return fail(503, OFF_MESSAGE.level2Scoring, { code: "FEATURE_OFF" });
  const mine = await myLevel2Reviews(user);
  const need = topPicksNeeded(mine.length);
  if (!need) return fail(404, "No Level 2 applicants are assigned to you.");
  const scored = new Map(mine.filter((x) => x.review.status === "SUBMITTED" && x.review.percent !== null).map((x) => [x.submission.level1Code, x]));
  if (scored.size < need) return fail(422, `Submit at least ${need} review${need === 1 ? "" : "s"} first. You have submitted ${scored.size}.`);
  const list = Array.isArray(body.picks) ? body.picks.slice(0, L2_TOP_PICKS) : [];
  const errors: ReviewErrors = {};
  const picks: Array<{ code: string; reason: string }> = [];
  for (let i = 0; i < need; i++) {
    const p = (list[i] && typeof list[i] === "object" ? list[i] : {}) as Record<string, unknown>;
    const code = clean(p.code, 40).toUpperCase(), reason = clean(p.reason, 500);
    if (!code) errors[`pick${i}`] = "Choose an applicant.";
    else if (!scored.has(code)) errors[`pick${i}`] = "Choose one of the applicants you have submitted.";
    else if (picks.some((x) => x.code === code)) errors[`pick${i}`] = "This applicant is already in your top 3.";
    if (reason.length < 10) errors[`reason${i}`] = "Say in a sentence why this applicant is in your top 3.";
    picks.push({ code, reason });
  }
  if (Object.keys(errors).length) return fail(422, "A few answers are missing.", { errors });
  const rankOf = new Map(picks.map((p, i) => [p.code, { rank: i + 1, reason: p.reason }]));
  const changes = mine.flatMap(({ review: r }) => {
    const want = rankOf.get(r.level1Code) ?? { rank: null, reason: "" };
    return want.rank === r.topRank && want.reason === r.topReason ? [] : [{ reviewId: r.reviewId, patch: { topRank: want.rank, topReason: want.reason, updatedAt: r.updatedAt } }];
  });
  if (changes.length) await getRepository().updateLevel2Reviews(changes);
  await getRepository().logEvent({ at: now(), applicationId: "-", actor: user.email, action: "LEVEL2_TOP_PICKS", detail: picks.map((p, i) => `${i + 1}. ${p.code}`).join(", ") }).catch(() => {});
  return { ok: true, status: 200, data: { saved: picks.length } };
}

/** May this reviewer open this file? Only files of Level 2 applicants assigned to them. */
export async function level2ReviewerMayOpen(user: SessionUser, url: string) {
  if (!isPanel(user) || !url) return false;
  return (await myLevel2Reviews(user)).some(({ submission }) => L2_DOC_FIELDS.some((k) => submission[k] === url));
}
