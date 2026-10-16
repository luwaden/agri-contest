import "server-only";
import { cache } from "react";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getRepository } from "@/lib/repository";
import { loadApplications } from "@/lib/data";
import { preScreen, rankEligible, pickWithSpread, type PreScore } from "@/lib/screening";
import { planAssignments, buildResults } from "@/lib/judging";
import { SCREENING } from "@/config/screening";
import { zoneOf } from "@/config/admin";
import { csvCell } from "@/lib/csv";
import { isLiveReview, type PanelReview, type PanelRole } from "@/types/review";
import type { Application } from "@/types/application";
import type { SessionUser } from "@/types/user";
import type { ServiceResult } from "./applicationService";
import { listPanelists, autoAssign } from "./reviewService";

const fail = (status: number, message: string, extra: Record<string, unknown> = {}) => ({ ok: false as const, status, body: { message, ...extra } });
const now = () => new Date().toISOString();
const newReviewId = () => `RV-${randomBytes(6).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
const blankReview = (applicationId: string, panelEmail: string, panelName: string, role: PanelRole, actor: string, at: string): PanelReview => ({
  reviewId: newReviewId(), applicationId, panelEmail, panelName, panelRole: role, status: "ASSIGNED", assignedAt: at, assignedBy: actor,
  scores: {}, comments: {}, overallComment: "", total: null, conflictNote: "", updatedAt: at, submittedAt: null, decision: null,
});

// Scoring 6,000+ applications takes milliseconds, but do it once per loaded copy of the sheet.
const scoredFor = new WeakMap<Application[], { scored: PreScore[]; ranked: PreScore[]; byId: Map<string, PreScore> }>();
function scoreAll(applications: Application[]) {
  let s = scoredFor.get(applications);
  if (!s) {
    const scored = preScreen(applications);
    s = { scored, ranked: rankEligible(scored, applications), byId: new Map(scored.map((p) => [p.applicationId, p])) };
    scoredFor.set(applications, s);
  }
  return s;
}

/** Everything the Screening page needs, loaded once per request. */
export const screeningData = cache(async () => {
  const { applications } = await loadApplications();
  const reviews = await getRepository().getReviews();
  const panelists = await listPanelists();
  return { applications, apps: new Map(applications.map((a) => [a.applicationId, a])), reviews, panelists, ...scoreAll(applications) };
});

const liveRole = (reviews: PanelReview[], role: PanelRole) => reviews.filter((r) => r.panelRole === role && isLiveReview(r));
const passedIds = (reviews: PanelReview[]) => [...new Set(liveRole(reviews, "REVIEWER").filter((r) => r.decision === "PASS").map((r) => r.applicationId))];

// ───────────── step 1: eligibility and the shortlist ─────────────
export async function summary(shortlistSize: number = SCREENING.shortlistSize) {
  const d = await screeningData();
  const reasons = new Map<string, number>();
  for (const p of d.scored) for (const r of p.ineligibleReasons) {
    const key = r.replace(/".*?"/g, "…").replace(/\d+/g, "#");   // group "Age 37 …" and "Age 40 …" together
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  const cut = d.ranked[Math.min(shortlistSize, d.ranked.length) - 1];
  return {
    submitted: d.scored.length, eligible: d.ranked.length, ineligible: d.scored.length - d.ranked.length,
    duplicates: d.scored.filter((p) => p.duplicateOf).length, flagged: d.ranked.filter((p) => p.flags.length).length,
    reasons: [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([reason, count]) => ({ reason, count })),
    shortlistSize: Math.min(shortlistSize, d.ranked.length), cutOffScore: cut?.total ?? null, topScore: d.ranked[0]?.total ?? null,
  };
}

// ───────────── step 2: the review batch ─────────────
const batchSchema = z.object({
  shortlistSize: z.coerce.number().int().min(1).max(20_000).default(SCREENING.shortlistSize),
  size: z.coerce.number().int().min(1, "Choose at least 1 application.").max(5_000),
  reviewerEmails: z.array(z.string().email().max(120)).min(1, "Choose at least one reviewer.").max(60),
  dryRun: z.boolean().default(true),
});

/** Picks the batch from the shortlist (fair spread) and shares it evenly between the chosen reviewers. dryRun only previews. */
export async function createBatch(input: unknown, actor: string): Promise<ServiceResult<Record<string, unknown>>> {
  const p = batchSchema.safeParse(input);
  if (!p.success) return fail(422, p.error.issues[0]?.message ?? "Please check the choices.");
  const o = p.data;
  if (o.size > o.shortlistSize) return fail(422, `The batch (${o.size}) cannot be bigger than the shortlist (${o.shortlistSize}).`);
  const d = await screeningData();
  const chosen = new Set(o.reviewerEmails.map((e) => e.trim().toLowerCase()));
  const reviewers = d.panelists.filter((x) => x.role === "REVIEWER" && chosen.has(x.email));
  if (!reviewers.length) return fail(422, "None of the chosen people is an active reviewer. Add reviewers on the Staff page first.");

  const { picks, groups } = pickWithSpread(d.ranked.slice(0, o.shortlistSize), d.applications, o.size);
  const inRound = new Set(liveRole(d.reviews, "REVIEWER").map((r) => r.applicationId));
  const need = picks.filter((x) => !inRound.has(x.applicationId));
  const plan = planAssignments({
    applications: need.map((x) => ({ applicationId: x.applicationId, applicantEmail: d.apps.get(x.applicationId)!.applicant.email })),
    panelists: reviewers, existing: d.reviews, perApplication: 1, role: "REVIEWER",
  });
  const summaryOut = {
    picked: picks.length, alreadyAssigned: picks.length - need.length, creates: plan.create.length, shortfalls: plan.shortfalls.length,
    bySpread: picks.filter((x) => x.via !== "Rank").length, groups,
    loadAfter: plan.loadAfter.filter((l) => chosen.has(l.email)), perReviewer: Math.ceil(picks.length / reviewers.length),
    lowestScore: picks.length ? Math.min(...picks.map((x) => d.byId.get(x.applicationId)!.total)) : null,
  };
  if (o.dryRun || !plan.create.length) return { ok: true, status: 200, data: { ...summaryOut, applied: false } };

  const at = now();
  const rows = plan.create.map((c) => blankReview(c.applicationId, c.panelEmail, c.panelName, "REVIEWER", actor, at));
  const added = await getRepository().createReviews(rows);
  await getRepository().logEvent({ at, applicationId: "-", actor, action: "SCREENING_BATCH_CREATED", detail: `${added} application(s) to ${reviewers.length} reviewer(s); shortlist ${o.shortlistSize}, batch ${o.size}` });
  return { ok: true, status: 200, data: { ...summaryOut, applied: true, added } };
}

// ───────────── step 3: who has what, and moving work ─────────────
export async function board(role: PanelRole = "REVIEWER") {
  const d = await screeningData();
  const live = liveRole(d.reviews, role);
  const people = d.panelists.filter((x) => x.role === role).map((person) => {
    const mine = live.filter((r) => r.panelEmail === person.email);
    return {
      email: person.email, name: person.name, assigned: mine.length, passed: mine.filter((r) => r.decision === "PASS").length,
      submitted: mine.filter((r) => r.status === "SUBMITTED").length,
      items: mine.map((r) => {
        const a = d.apps.get(r.applicationId), s = d.byId.get(r.applicationId);
        return { reviewId: r.reviewId, applicationId: r.applicationId, businessName: a?.business.businessName ?? "(not found)", state: a?.location.state ?? "",
          valueChain: a?.business.valueChain ?? "", aiScore: s?.total ?? null, status: r.status, decision: r.decision, total: r.total };
      }).sort((x, y) => (y.aiScore ?? 0) - (x.aiScore ?? 0)),
    };
  });
  const conflicts = d.reviews.filter((r) => r.panelRole === role && r.status === "CONFLICT")
    .filter((c) => !live.some((r) => r.applicationId === c.applicationId))   // still nobody else has it
    .map((c) => ({ reviewId: c.reviewId, applicationId: c.applicationId, panelName: c.panelName, note: c.conflictNote, businessName: d.apps.get(c.applicationId)?.business.businessName ?? "" }));
  return { people, conflicts, inRound: new Set(live.map((r) => r.applicationId)).size, passed: passedIds(d.reviews).length };
}

const moveSchema = z.object({
  reviewIds: z.array(z.string().min(4).max(40)).min(1, "Tick at least one application.").max(1_000),
  /** An email, or "EVEN" to share them out among the other people in the same role. */
  to: z.string().min(2).max(120).transform((s) => s.trim().toLowerCase()),
  /** true = only say what would happen (used by the assistant before the admin confirms). */
  dryRun: z.boolean().default(false),
});

/**
 * Moves applications from one panel member to another (or shares them out evenly). The old assignment is kept as
 * WITHDRAWN for the audit trail. Submitted sheets and passed applications are never moved silently.
 */
export async function moveReviews(input: unknown, actor: string): Promise<ServiceResult<Record<string, unknown>>> {
  const p = moveSchema.safeParse(input);
  if (!p.success) return fail(422, p.error.issues[0]?.message ?? "Please check the choices.");
  const d = await screeningData();
  const byId = new Map(d.reviews.map((r) => [r.reviewId, r]));
  const rows = p.data.reviewIds.map((id) => byId.get(id)).filter((r): r is PanelReview => !!r);
  if (!rows.length) return fail(404, "Those assignments no longer exist. Reload the page.");
  const role = rows[0].panelRole;
  if (rows.some((r) => r.panelRole !== role)) return fail(422, "Move reviewers' and judges' work separately.");
  const people = d.panelists.filter((x) => x.role === role);
  const even = p.data.to === "even";
  const target = even ? null : people.find((x) => x.email === p.data.to);
  if (!even && !target) return fail(422, `That person is not an active ${role === "JUDGE" ? "judge" : "reviewer"}.`);

  const load = new Map(people.map((x) => [x.email, 0]));
  for (const r of liveRole(d.reviews, role)) if (load.has(r.panelEmail)) load.set(r.panelEmail, load.get(r.panelEmail)! + 1);
  const all = new Map<string, PanelReview[]>();
  for (const r of d.reviews) all.set(r.applicationId, [...(all.get(r.applicationId) ?? []), r]);

  const skipped: string[] = []; const withdraw: string[] = []; const reactivate: string[] = []; const create: PanelReview[] = [];
  const at = now(); const moved: Array<{ applicationId: string; from: string; to: string }> = [];
  for (const r of rows) {
    if (!isLiveReview(r)) { skipped.push(`${r.applicationId}: not active`); continue; }
    if (r.status === "SUBMITTED") { skipped.push(`${r.applicationId}: already submitted by ${r.panelName}`); continue; }
    if (r.decision === "PASS") { skipped.push(`${r.applicationId}: already passed by ${r.panelName}`); continue; }
    const app = d.apps.get(r.applicationId);
    const others = (all.get(r.applicationId) ?? []).filter((x) => x.panelRole === role);
    const canTake = (email: string) => email !== r.panelEmail && email !== app?.applicant.email.trim().toLowerCase()
      && !others.some((x) => x.panelEmail === email && (isLiveReview(x) || x.status === "CONFLICT"));
    const who = even ? people.filter((x) => canTake(x.email))
      .sort((a, b) => load.get(a.email)! - load.get(b.email)! || a.email.localeCompare(b.email))[0] : (target && canTake(target.email) ? target : null);
    if (!who) { skipped.push(`${r.applicationId}: nobody suitable to take it (own application, conflict, or already has it)`); continue; }
    withdraw.push(r.reviewId);
    const old = others.find((x) => x.panelEmail === who.email && x.status === "WITHDRAWN");
    if (old) reactivate.push(old.reviewId); else create.push(blankReview(r.applicationId, who.email, who.name, role, actor, at));
    others.push({ ...(old ?? create[create.length - 1]), status: "ASSIGNED" });
    load.set(who.email, load.get(who.email)! + 1); load.set(r.panelEmail, (load.get(r.panelEmail) ?? 1) - 1);
    moved.push({ applicationId: r.applicationId, from: r.panelName, to: who.name });
  }
  if (!moved.length) return fail(409, "Nothing was moved.", { skipped });
  if (p.data.dryRun) {
    const to = new Map<string, number>(); for (const m of moved) to.set(m.to, (to.get(m.to) ?? 0) + 1);
    return { ok: true, status: 200, data: { applied: false, moved: moved.length, skipped, byPerson: [...to].map(([name, count]) => ({ name, count })) } };
  }

  const repo = getRepository();
  await repo.updateReviews([
    ...withdraw.map((reviewId) => ({ reviewId, patch: { status: "WITHDRAWN" as const, updatedAt: at } })),
    ...reactivate.map((reviewId) => ({ reviewId, patch: { status: "ASSIGNED" as const, assignedAt: at, assignedBy: actor, scores: {}, comments: {}, overallComment: "", total: null, submittedAt: null, conflictNote: "", decision: null, updatedAt: at } })),
  ]);
  if (create.length) await repo.createReviews(create);
  await repo.logEvent({ at, applicationId: "-", actor, action: "PANEL_MOVED", detail: `${moved.length} ${role.toLowerCase()} assignment(s) moved${even ? " and shared evenly" : ` to ${target!.email}`}` });
  return { ok: true, status: 200, data: { moved: moved.length, skipped, detail: moved.slice(0, 50) } };
}

// ───────────── reviewers: pass to the next stage ─────────────
export async function passState(user: SessionUser) {
  if (user.role !== "REVIEWER") return null;
  const mine = liveRole(await getRepository().getReviews(), "REVIEWER").filter((r) => r.panelEmail === user.email.toLowerCase());
  return { passed: mine.filter((r) => r.decision === "PASS").length, limit: SCREENING.passPerReviewer, assigned: mine.length };
}

/** A reviewer passes (or un-passes) one of their own applications. The limit is checked on the server. */
export async function setDecision(user: SessionUser, applicationId: string, pass: boolean): Promise<ServiceResult<{ decision: "PASS" | null; passed: number; limit: number }>> {
  if (user.role !== "REVIEWER") return fail(403, "Only reviewers pass applications to the next stage.");
  const repo = getRepository();
  const mine = liveRole(await repo.getReviews(), "REVIEWER").filter((r) => r.panelEmail === user.email.toLowerCase());
  const row = mine.find((r) => r.applicationId === applicationId);
  if (!row) return fail(404, "This application is not assigned to you.");
  const limit = SCREENING.passPerReviewer;
  const passed = mine.filter((r) => r.decision === "PASS").length;
  if (pass && row.decision !== "PASS" && passed >= limit)
    return fail(409, `You have already passed ${limit}. Remove one of your passes first if you want to pass this one instead.`, { passed, limit });
  const decision = pass ? "PASS" as const : null;
  if (row.decision !== decision) {
    await repo.updateReview(row.reviewId, { decision });
    await repo.logEvent({ at: now(), applicationId, actor: user.email, action: pass ? "SCREENING_PASSED" : "SCREENING_PASS_REMOVED", detail: "REVIEWER" });
  }
  const after = passed + (decision === row.decision ? 0 : pass ? 1 : -1);
  return { ok: true, status: 200, data: { decision, passed: after, limit } };
}

// ───────────── step 4: judges ─────────────
const judgesSchema = z.object({ perApplication: z.coerce.number().int().min(1).max(10).default(1), dryRun: z.boolean().default(true) });

/** Gives every application a reviewer passed to the judges (the normal judging assignment, limited to the passed list). */
export async function sendPassedToJudges(input: unknown, actor: string) {
  const p = judgesSchema.safeParse(input);
  if (!p.success) return fail(422, "Choose how many judges each application should have (1 to 10).");
  const ids = passedIds((await screeningData()).reviews);
  if (!ids.length) return fail(422, "No reviewer has passed any application yet.");
  return autoAssign({ role: "JUDGE", perApplication: p.data.perApplication, statuses: ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "FINALIST", "NOT_SELECTED", "WINNER"], applicationIds: ids, dryRun: p.data.dryRun }, actor);
}

// ───────────── CSV downloads ─────────────
export type ListKind = "shortlist" | "all" | "batch" | "passed" | "finalists";
const toCsv = (head: string[], rows: unknown[][]) => "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
const PERSON = ["first_name", "last_name", "email", "phone", "gender", "age", "state", "zone", "lga", "rural", "business_name", "value_chain", "business_stage", "generates_revenue"];
const person = (a?: Application) => a ? [a.applicant.firstName, a.applicant.lastName, a.applicant.email, a.applicant.phone, a.applicant.gender, a.applicant.age, a.location.state, zoneOf(a.location.state), a.location.lga, a.inclusion.rural ? "yes" : "no", a.business.businessName, a.business.valueChain === "OTHER" && a.business.valueChainOther ? a.business.valueChainOther : a.business.valueChain, a.business.stage, a.business.generatesRevenue ? "yes" : "no"] : PERSON.map(() => "");
const AI = ["ai_score", "originality", "feasibility", "scalability", "impact", "market", "strengths", "weaknesses", "flags"];
const ai = (s?: PreScore) => s ? [s.total, s.scores.originality, s.scores.feasibility, s.scores.scalability, s.scores.impact, s.scores.market, s.strengths.join("; "), s.weaknesses.join("; "), s.flags.join("; ")] : AI.map(() => "");

export async function listCsv(kind: ListKind, size?: number): Promise<{ filename: string; csv: string; rows: number }> {
  const d = await screeningData();
  const day = now().slice(0, 10);
  if (kind === "shortlist" || kind === "all") {
    const n = kind === "shortlist" ? Math.min(size ?? SCREENING.shortlistSize, d.ranked.length) : d.ranked.length;
    const ranked = d.ranked.slice(0, n).map((s, i) => [i + 1, s.applicationId, ...person(d.apps.get(s.applicationId)), ...ai(s), "eligible", ""]);
    const rest = kind === "all" ? d.scored.filter((s) => !s.eligible).sort((a, b) => b.total - a.total).map((s) => ["", s.applicationId, ...person(d.apps.get(s.applicationId)), ...ai(s), "not eligible", s.ineligibleReasons.join("; ")]) : [];
    const rows = [...ranked, ...rest];
    return { filename: kind === "shortlist" ? `shortlist-top-${n}-${day}.csv` : `all-applications-screened-${day}.csv`, rows: rows.length,
      csv: toCsv(["rank", "application_id", ...PERSON, ...AI, "eligibility", "not_eligible_because"], rows) };
  }
  if (kind === "batch" || kind === "passed") {
    const live = liveRole(d.reviews, "REVIEWER").filter((r) => kind === "batch" || r.decision === "PASS");
    const rows = live.map((r) => [r.applicationId, ...person(d.apps.get(r.applicationId)), ...ai(d.byId.get(r.applicationId)), r.panelName, r.panelEmail, r.decision === "PASS" ? "passed" : "", r.status])
      .sort((a, b) => String(a[a.length - 4]).localeCompare(String(b[b.length - 4])));
    return { filename: `${kind === "batch" ? "review-batch" : "passed-by-reviewers"}-${day}.csv`, rows: rows.length,
      csv: toCsv(["application_id", ...PERSON, ...AI, "reviewer", "reviewer_email", "decision", "review_status"], rows) };
  }
  const results = buildResults(d.applications, d.reviews, "JUDGE").filter((r) => r.average !== null);
  const n = Math.min(size ?? SCREENING.finalists, results.length);
  const rows = results.slice(0, n).map((r) => [r.rank, r.applicationId, ...person(d.apps.get(r.applicationId)), r.average, r.submitted, r.flags.join(" "), d.byId.get(r.applicationId)?.total ?? ""]);
  return { filename: `top-${n}-judges-${day}.csv`, rows: rows.length, csv: toCsv(["rank", "application_id", ...PERSON, "judges_average", "judges_scored", "flags", "ai_score"], rows) };
}

// ───────────── helpers for the screening assistant ─────────────
export async function rankedData() { const d = await screeningData(); return { applications: d.applications, ranked: d.ranked, byId: d.byId, apps: d.apps, reviews: d.reviews, panelists: d.panelists }; }
export { PERSON as CSV_PERSON_COLUMNS, AI as CSV_SCORE_COLUMNS, person as csvPersonCells, ai as csvScoreCells, toCsv };
