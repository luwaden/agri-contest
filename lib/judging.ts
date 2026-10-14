/**
 * Pure judging logic (no storage, no auth), so it can be unit-tested directly:
 *   - planAssignments: spreads applications evenly across judges/reviewers, never twice to the same person,
 *     never to someone who declared a conflict, never to the applicant themselves
 *   - checkScoreSheet: validates a score sheet for "save" or "submit"
 *   - buildResults: averages, per-criterion averages, spread and tie flags, ranking with the framework tie-breaks
 *   - panelView: what a judge/reviewer may see of an application (no contact details)
 */
import { DEFAULT_CRITERIA } from "@/config/scoring";
import { averageScore } from "@/types/scoring";
import { compareRanked, weightedTotal } from "@/lib/scoring";
import type { Application } from "@/types/application";
import { isLiveReview, type PanelReview, type PanelRole } from "@/types/review";

export const ACTIVE_CRITERIA = DEFAULT_CRITERIA.filter((c) => c.active);
/** Totals further apart than this (out of 100) are flagged for a second look. A working threshold, not a programme rule. */
export const SPREAD_ALERT = 20;

// ───────────── assignment ─────────────
export interface Panelist { email: string; name: string; role: PanelRole }
export interface AssignmentPlan {
  create: Array<{ applicationId: string; panelEmail: string; panelName: string }>;
  shortfalls: Array<{ applicationId: string; missing: number }>;
  loadAfter: Array<{ email: string; name: string; before: number; after: number }>;
}

/** Small seeded shuffle so equal workloads are broken fairly but the preview and the real run give the same result. */
function seeded(seed: string) { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }

export function planAssignments(input: {
  applications: Array<{ applicationId: string; applicantEmail: string }>;
  panelists: Panelist[];
  existing: PanelReview[];         // every review row (any role/status)
  perApplication: number;
  role: PanelRole;
}): AssignmentPlan {
  const people = input.panelists.filter((p) => p.role === input.role);
  const mine = input.existing.filter((r) => r.panelRole === input.role);
  const load = new Map(people.map((p) => [p.email, 0]));
  for (const r of mine) if (isLiveReview(r) && load.has(r.panelEmail)) load.set(r.panelEmail, load.get(r.panelEmail)! + 1);
  const before = new Map(load);
  const rand = seeded(`${input.role}:${people.map((p) => p.email).join(",")}:${mine.length}`);
  const tiebreak = new Map(people.map((p) => [p.email, rand()]));

  const byApp = new Map<string, PanelReview[]>();
  for (const r of input.existing) byApp.set(r.applicationId, [...(byApp.get(r.applicationId) ?? []), r]);
  const liveCount = (id: string) => (byApp.get(id) ?? []).filter((r) => r.panelRole === input.role && isLiveReview(r)).length;

  const plan: AssignmentPlan = { create: [], shortfalls: [], loadAfter: [] };
  // Applications with the fewest panel members go first, so a small panel is shared out evenly.
  const queue = [...input.applications].sort((a, b) => liveCount(a.applicationId) - liveCount(b.applicationId) || a.applicationId.localeCompare(b.applicationId));
  for (const app of queue) {
    const need = input.perApplication - liveCount(app.applicationId);
    if (need <= 0) continue;
    const taken = new Set((byApp.get(app.applicationId) ?? []).map((r) => r.panelEmail));   // incl. conflicts and withdrawn
    const candidates = people
      .filter((p) => !taken.has(p.email) && p.email !== app.applicantEmail.trim().toLowerCase())
      .sort((a, b) => load.get(a.email)! - load.get(b.email)! || tiebreak.get(a.email)! - tiebreak.get(b.email)!);
    const chosen = candidates.slice(0, need);
    for (const p of chosen) { plan.create.push({ applicationId: app.applicationId, panelEmail: p.email, panelName: p.name }); load.set(p.email, load.get(p.email)! + 1); }
    if (chosen.length < need) plan.shortfalls.push({ applicationId: app.applicationId, missing: need - chosen.length });
  }
  plan.loadAfter = people.map((p) => ({ email: p.email, name: p.name, before: before.get(p.email)!, after: load.get(p.email)! })).sort((a, b) => b.after - a.after || a.name.localeCompare(b.name));
  return plan;
}

// ───────────── score sheet ─────────────
export interface ScoreSheetInput { scores?: unknown; comments?: unknown; overallComment?: unknown; confirmNoConflict?: unknown }
export type ScoreSheetErrors = Record<string, string>;
export const OVERALL_MIN = 20;

export function checkScoreSheet(input: ScoreSheetInput, submit: boolean):
  { ok: true; scores: Record<string, number>; comments: Record<string, string>; overallComment: string; total: number | null } | { ok: false; errors: ScoreSheetErrors } {
  const errors: ScoreSheetErrors = {};
  const rawScores = input.scores && typeof input.scores === "object" ? (input.scores as Record<string, unknown>) : {};
  const rawComments = input.comments && typeof input.comments === "object" ? (input.comments as Record<string, unknown>) : {};
  const scores: Record<string, number> = {}, comments: Record<string, string> = {};
  for (const c of ACTIVE_CRITERIA) {
    const v = rawScores[c.id];
    if (v === undefined || v === null || v === "") { if (submit) errors[c.id] = `Please give a score for ${c.name}.`; }
    else if (!Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > c.maximumScore) errors[c.id] = `${c.name}: choose a whole number from 1 to ${c.maximumScore}.`;
    else scores[c.id] = Number(v);
    const note = typeof rawComments[c.id] === "string" ? (rawComments[c.id] as string).trim() : "";
    if (note.length > 1000) errors[`comment_${c.id}`] = "Please keep this note under 1,000 characters.";
    else if (note) comments[c.id] = note;
  }
  const overallComment = typeof input.overallComment === "string" ? input.overallComment.trim() : "";
  if (overallComment.length > 3000) errors.overallComment = "Please keep the overall comment under 3,000 characters.";
  if (submit && overallComment.length < OVERALL_MIN) errors.overallComment = `Please write a short overall comment (at least ${OVERALL_MIN} characters) explaining your scores.`;
  if (submit && input.confirmNoConflict !== true) errors.confirmNoConflict = "Please confirm you have no conflict of interest with this applicant, or declare one instead.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, scores, comments, overallComment, total: submit ? weightedTotal(scores, ACTIVE_CRITERIA) : null };
}

// ───────────── results ─────────────
export interface ResultRow {
  applicationId: string; businessName: string; valueChain: string; state: string; status: string;
  assigned: number; submitted: number; conflicts: number;
  average: number | null; criterionAverages: Record<string, number>; min: number | null; max: number | null;
  rank: number | null; flags: Array<"SPREAD" | "TIE" | "WAITING" | "NEEDS_PANEL">;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildResults(apps: Application[], reviews: PanelReview[], role: PanelRole): ResultRow[] {
  const mine = reviews.filter((r) => r.panelRole === role);
  const ids = new Set(mine.map((r) => r.applicationId));
  const rows: ResultRow[] = apps.filter((a) => ids.has(a.applicationId)).map((a) => {
    const rs = mine.filter((r) => r.applicationId === a.applicationId);
    const done = rs.filter((r) => r.status === "SUBMITTED" && typeof r.total === "number");
    const totals = done.map((r) => r.total as number);
    const avg = averageScore(totals);
    const crit: Record<string, number> = {};
    for (const c of ACTIVE_CRITERIA) { const v = averageScore(done.map((r) => r.scores[c.id])); if (v !== null) crit[c.id] = r2(v); }
    const live = rs.filter(isLiveReview).length;
    const flags: ResultRow["flags"] = [];
    if (totals.length >= 2 && Math.max(...totals) - Math.min(...totals) >= SPREAD_ALERT) flags.push("SPREAD");
    if (done.length < live) flags.push("WAITING");
    if (live === 0) flags.push("NEEDS_PANEL");
    return {
      applicationId: a.applicationId, businessName: a.business.businessName, valueChain: a.business.valueChain, state: a.location.state, status: a.submissionStatus,
      assigned: live, submitted: done.length, conflicts: rs.filter((r) => r.status === "CONFLICT").length,
      average: avg === null ? null : r2(avg), criterionAverages: crit, min: totals.length ? Math.min(...totals) : null, max: totals.length ? Math.max(...totals) : null, rank: null, flags,
    };
  });
  const scored = rows.filter((r) => r.average !== null)
    .map((r) => ({ row: r, ranked: { id: r.applicationId, total: r.average as number, raw: r.criterionAverages } }))
    .sort((x, y) => compareRanked(x.ranked, y.ranked));
  scored.forEach((s, i) => {
    const prev = scored[i - 1], next = scored[i + 1];
    s.row.rank = prev && compareRanked(prev.ranked, s.ranked) === 0 ? prev.row.rank : i + 1;
    if ((prev && compareRanked(prev.ranked, s.ranked) === 0) || (next && compareRanked(s.ranked, next.ranked) === 0)) s.row.flags.push("TIE");
  });
  return [...scored.map((s) => s.row), ...rows.filter((r) => r.average === null).sort((a, b) => a.applicationId.localeCompare(b.applicationId))];
}

// ───────────── what panel members see ─────────────
/** Everything needed to judge the business, plus the applicant's name (needed to spot a conflict of interest).
 *  Never: phone, WhatsApp, email, home address, date of birth, disability details. */
export function panelView(a: Application) {
  const b = a.business, i = a.impact;
  return {
    applicationId: a.applicationId, status: a.submissionStatus, submittedAt: a.submittedAt,
    applicantName: `${a.applicant.firstName} ${a.applicant.lastName}`.replace(/\s+/g, " ").trim(),
    state: a.location.state, lga: a.location.lga, rural: a.inclusion.rural,
    business: {
      businessName: b.businessName, valueChain: b.valueChain, valueChainOther: b.valueChainOther, stage: b.stage, registrationStatus: b.registrationStatus,
      yearStarted: b.yearStarted, setting: b.setting, website: b.website, socialHandles: b.socialHandles, applicantRole: b.applicantRole,
      description: b.description, problem: b.problem, solution: b.solution, originality: b.originality, innovation: b.innovation,
      mainCustomers: b.mainCustomers, targetMarket: b.targetMarket, customersServed: b.customersServed,
      generatesRevenue: b.generatesRevenue, revenueRange: b.revenueRange, revenueSource: b.revenueSource, employees: b.employees,
    },
    impact: { ...i },
    supportNeeds: a.supportNeeds, programmeGoal: a.programmeGoal,
    documents: a.documents,
  };
}
export type PanelApplicationView = ReturnType<typeof panelView>;
