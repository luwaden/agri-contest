import test from "node:test";
import assert from "node:assert/strict";
import { buildResults, checkScoreSheet, panelView, planAssignments, ACTIVE_CRITERIA } from "../lib/judging";
import { reviewToRow, rowToReview, REVIEW_HEADERS } from "../lib/google-sheets/reviewSchema";
import { weightedTotal } from "../lib/scoring";
import { demoApplications } from "../lib/demo";
import { audiencesFor } from "../config/knowledge";
import type { PanelReview } from "../types/review";

const people = (n: number, role: "REVIEWER" | "JUDGE" = "REVIEWER") => Array.from({ length: n }, (_, i) => ({ email: `${role.toLowerCase()}${i + 1}@example.org`, name: `${role} ${i + 1}`, role }));
const apps = (n: number) => Array.from({ length: n }, (_, i) => ({ applicationId: `AGRA-2026-AAAA${String(i).padStart(2, "2")}`.slice(0, 16), applicantEmail: `applicant${i}@example.org` }));
const toRows = (plan: ReturnType<typeof planAssignments>, role: "REVIEWER" | "JUDGE" = "REVIEWER", status: PanelReview["status"] = "ASSIGNED"): PanelReview[] =>
  plan.create.map((c, i) => ({ reviewId: `RV-${i}`, applicationId: c.applicationId, panelEmail: c.panelEmail, panelName: c.panelName, panelRole: role, status, assignedAt: "2026-10-10T10:00:00Z", assignedBy: "a", scores: {}, comments: {}, overallComment: "", total: null, conflictNote: "", updatedAt: "2026-10-10T10:00:00Z", submittedAt: null, decision: null }));

// ───────── assignment ─────────
test("assignment: shares work evenly, never the same person twice on one application", () => {
  const plan = planAssignments({ applications: apps(10), panelists: people(3), existing: [], perApplication: 2, role: "REVIEWER" });
  assert.equal(plan.create.length, 20); assert.equal(plan.shortfalls.length, 0);
  const loads = plan.loadAfter.map((p) => p.after).sort(); assert.deepEqual(loads, [6, 7, 7]);
  for (const a of apps(10)) { const who = plan.create.filter((c) => c.applicationId === a.applicationId).map((c) => c.panelEmail); assert.equal(new Set(who).size, 2); }
});
test("assignment: running again only fills gaps, and takes existing workload into account", () => {
  const first = planAssignments({ applications: apps(6), panelists: people(2), existing: [], perApplication: 1, role: "REVIEWER" });
  const existing = toRows(first);
  assert.equal(planAssignments({ applications: apps(6), panelists: people(2), existing, perApplication: 1, role: "REVIEWER" }).create.length, 0, "nothing new");
  const more = planAssignments({ applications: apps(6), panelists: people(3), existing, perApplication: 1, role: "REVIEWER" });
  assert.equal(more.create.length, 0, "a new person does not take work already given");
  const second = planAssignments({ applications: apps(6), panelists: people(3), existing, perApplication: 2, role: "REVIEWER" });
  assert.equal(second.create.length, 6); assert.equal(second.loadAfter.find((p) => p.email === "reviewer3@example.org")!.after, 4, "the new person is filled up first");
});
test("assignment: a conflict frees a slot but that person never gets the application again; nor does the applicant", () => {
  const a = apps(1); const plan = planAssignments({ applications: a, panelists: people(2), existing: [], perApplication: 1, role: "REVIEWER" });
  const rows = toRows(plan, "REVIEWER", "CONFLICT");
  const again = planAssignments({ applications: a, panelists: people(2), existing: rows, perApplication: 1, role: "REVIEWER" });
  assert.equal(again.create.length, 1); assert.notEqual(again.create[0].panelEmail, plan.create[0].panelEmail);
  const self = planAssignments({ applications: [{ applicationId: "AGRA-2026-SELF22", applicantEmail: "Reviewer1@Example.org " }], panelists: people(1), existing: [], perApplication: 1, role: "REVIEWER" });
  assert.equal(self.create.length, 0); assert.deepEqual(self.shortfalls, [{ applicationId: "AGRA-2026-SELF22", missing: 1 }]);
});
test("assignment: judges and reviewers are separate pools", () => {
  const reviewers = toRows(planAssignments({ applications: apps(4), panelists: people(2), existing: [], perApplication: 2, role: "REVIEWER" }));
  const judges = planAssignments({ applications: apps(4), panelists: [...people(2), ...people(3, "JUDGE")], existing: reviewers, perApplication: 3, role: "JUDGE" });
  assert.equal(judges.create.length, 12); assert.ok(judges.create.every((c) => c.panelEmail.startsWith("judge")));
});

// ───────── score sheet ─────────
const full = { originality: 8, feasibility: 7, scalability: 6, impact: 9, market: 5 };
test("score sheet: a draft can be partial; submitting needs every score, a comment and the no-conflict confirmation", () => {
  assert.equal(checkScoreSheet({ scores: { originality: 8 } }, false).ok, true);
  const r = checkScoreSheet({ scores: { originality: 8 }, overallComment: "short" }, true);
  assert.equal(r.ok, false); if (!r.ok) { for (const k of ["feasibility", "scalability", "impact", "market", "overallComment", "confirmNoConflict"]) assert.ok(r.errors[k], k); assert.equal(r.errors.originality, undefined); }
  const ok = checkScoreSheet({ scores: full, overallComment: "A clear, credible plan with real customers.", confirmNoConflict: true }, true);
  assert.equal(ok.ok, true); if (ok.ok) assert.equal(ok.total, weightedTotal(full, ACTIVE_CRITERIA));
});
test("score sheet: rejects 0, 11, decimals and text; the total is weighted out of 100", () => {
  for (const bad of [0, 11, 7.5, "seven"]) assert.equal(checkScoreSheet({ scores: { originality: bad } }, false).ok, false, String(bad));
  const tens = Object.fromEntries(ACTIVE_CRITERIA.map((c) => [c.id, 10])), ones = Object.fromEntries(ACTIVE_CRITERIA.map((c) => [c.id, 5]));
  const t = checkScoreSheet({ scores: tens, overallComment: "x".repeat(25), confirmNoConflict: true }, true); assert.ok(t.ok && t.total === 100);
  const h = checkScoreSheet({ scores: ones, overallComment: "x".repeat(25), confirmNoConflict: true }, true); assert.ok(h.ok && h.total === 50);
});

// ───────── results ─────────
test("results: averages only submitted sheets, flags far-apart scores and ties, ranks with the framework tie-breaks", () => {
  const list = demoApplications(4);
  const R = (app: number, who: string, total: number | null, scores: Record<string, number> = {}, status: PanelReview["status"] = "SUBMITTED"): PanelReview =>
    ({ reviewId: `${app}${who}`, applicationId: list[app].applicationId, panelEmail: who, panelName: who, panelRole: "REVIEWER", status, assignedAt: "", assignedBy: "", scores, comments: {}, overallComment: "", total, conflictNote: "", updatedAt: "", submittedAt: "", decision: null });
  const s = (o: number, sc: number, f: number) => ({ originality: o, scalability: sc, feasibility: f, impact: 5, market: 5 });
  const reviews = [
    R(0, "a", 80, s(9, 8, 7)), R(0, "b", 50, s(5, 5, 5)),           // avg 65, spread 30
    R(1, "a", 60, s(6, 6, 6)), R(1, "b", 60, s(6, 6, 6)),           // tie with app 2
    R(2, "a", 60, s(6, 6, 6)), R(2, "b", 60, s(6, 6, 6)),
    R(3, "a", 90, s(9, 9, 9)), R(3, "b", null, {}, "IN_PROGRESS"), R(3, "c", null, {}, "CONFLICT"),
  ];
  const rows = buildResults(list, reviews, "REVIEWER");
  const by = (i: number) => rows.find((r) => r.applicationId === list[i].applicationId)!;
  assert.deepEqual(rows.slice(0, 2).map((r) => r.applicationId), [list[3].applicationId, list[0].applicationId]);
  assert.equal(by(3).average, 90); assert.deepEqual([by(3).submitted, by(3).assigned, by(3).conflicts], [1, 2, 1]); assert.ok(by(3).flags.includes("WAITING"));
  assert.ok(by(0).flags.includes("SPREAD")); assert.equal(by(0).average, 65);
  assert.ok(by(1).flags.includes("TIE") && by(2).flags.includes("TIE")); assert.equal(by(1).rank, by(2).rank);
  assert.equal(buildResults(list, reviews, "JUDGE").length, 0, "judges' results are separate");
});

// ───────── privacy ─────────
test("panel members never receive contact details, address, date of birth or disability details", () => {
  const a = demoApplications(1)[0]; const json = JSON.stringify(panelView(a));
  for (const secret of [a.applicant.email, a.applicant.phone, a.applicant.dateOfBirth, a.applicant.address].filter((x) => x && x.length > 4)) assert.ok(!json.includes(secret), secret);
  for (const key of ["email", "phone", "whatsapp", "dateOfBirth", "address", "disability"]) assert.ok(!new RegExp(`"${key}"`).test(json), key);
  assert.ok(json.includes(a.business.businessName));
});
test("judges and reviewers get no admin answers from the assistant", () => {
  assert.deepEqual(audiencesFor("REVIEWER"), ["public", "panel"]); assert.deepEqual(audiencesFor("JUDGE"), ["public", "panel"]);
});

// ───────── sheet row ─────────
test("Panel Reviews row: round trip, formula guard, and broken rows are ignored", () => {
  const r: PanelReview = { reviewId: "RV-ABC", applicationId: "AGRA-2026-AAAAA2", panelEmail: "x@example.org", panelName: "=Evil", panelRole: "JUDGE", status: "SUBMITTED", assignedAt: "2026-10-10T10:00:00Z", assignedBy: "a@example.org", scores: full, comments: { impact: "+good" }, overallComment: "@note", total: 71, conflictNote: "", updatedAt: "2026-10-11T10:00:00Z", submittedAt: "2026-10-11T10:00:00Z", decision: "PASS" };
  const row = reviewToRow(r); assert.equal(row.length, REVIEW_HEADERS.length); assert.equal(row[3], "'=Evil");
  assert.deepEqual(rowToReview(row), r);
  assert.equal(rowToReview(["RV-1", "AGRA-2026-AAAAA2", "x@example.org", "X", "MODERATOR", "SUBMITTED"]), null);
  assert.equal(rowToReview(["", "", ""]), null);
});

test("assistant: judges and reviewers get the panel answer for panel questions", async () => {
  const { rank } = await import("../lib/assistant/retrieve");
  const top = (q: string, role?: string) => rank(q, role)[0]?.entry.id;
  assert.equal(top("How do I score an application?", "REVIEWER"), "howscore");
  assert.equal(top("Where is the score sheet?", "JUDGE"), "howscore");
  assert.equal(top("I know this applicant, what do I do?", "JUDGE"), "coi");
  assert.equal(top("Can I change my score after submitting?", "REVIEWER"), "change");
  assert.equal(top("Can the AI summarise this application for me?", "JUDGE"), "aiscore");
  assert.equal(top("How do I assign applications to reviewers?", "ADMIN"), "assign");
  assert.equal(top("How do I apply?"), "how");
  assert.ok(!rank("How do I assign applications to reviewers?", "REVIEWER").some((r) => r.entry.audience === "admin"), "no admin answers for panel members");
});
test("demo applications are complete (none silently lose a stage)", () => {
  for (const a of demoApplications(64)) assert.ok(a.business.businessName && a.business.valueChain, a.applicationId);
});
