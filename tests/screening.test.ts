import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkEligibility, preScreen, rankEligible, pickWithSpread, textQuality } from "../lib/screening";
import { variedApplications } from "./helpers/varied";
import type { Application } from "../types/application";
import type { SessionUser } from "../types/user";

// Own process with a throw-away local store.
process.chdir(mkdtempSync(path.join(tmpdir(), "screening-test-")));
Object.assign(process.env, { DATA_BACKEND: "local" });
delete process.env.NEXT_PUBLIC_DEMO_MODE; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL; delete process.env.ADMIN_USERS_JSON;

const one = (patch: (a: Application) => void) => { const a = variedApplications(1, 99)[0]; patch(a); return a; };
const RICH = "We built a solar-powered dryer that cuts drying time from 7 days to 2 days for 40 bags at a time. Smallholder farmers lose about 30% of maize to poor storage, and our hermetic bags keep grain safe for 6 months. We serve 350 farmers and 12 schools.";

// ───────── eligibility ─────────
test("eligibility: age, nationality, declaration, state, complete answers, drafts", () => {
  assert.deepEqual(checkEligibility(one((a) => { a.business.description = a.business.problem = a.business.solution = RICH; })), []);
  const old = checkEligibility(one((a) => { a.applicant.dateOfBirth = "1980-01-01"; a.submittedAt = "2026-10-10T10:00:00Z"; }));
  assert.ok(old.some((r) => /^Age 46/.test(r)), old.join());
  assert.ok(checkEligibility(one((a) => { a.applicant.nationality = "Ghanaian"; })).some((r) => /Nationality/.test(r)));
  assert.deepEqual(checkEligibility(one((a) => { a.applicant.nationality = "nigeria"; a.business.description = a.business.problem = a.business.solution = RICH; })), []);
  assert.ok(checkEligibility(one((a) => { a.declaration.accepted = false; })).includes("Declaration not accepted"));
  assert.ok(checkEligibility(one((a) => { a.location.state = "Accra"; })).some((r) => /not a Nigerian state/.test(r)));
  assert.ok(checkEligibility(one((a) => { a.business.solution = "An app."; })).some((r) => /"solution" answer too short/.test(r)));
  assert.equal(preScreen([one((a) => { a.submissionStatus = "DRAFT"; })]).length, 0, "drafts are not screened at all");
});

// ───────── scoring ─────────
test("a specific, operating business scores above a thin idea; scores stay within 1..10 and the total within 0..100", () => {
  const strong = one((a) => {
    Object.assign(a.business, { stage: "GROWING", yearStarted: 2021, registrationStatus: "CAC_REGISTERED", applicantRole: "FOUNDER", generatesRevenue: true, revenueRange: "5M_20M", customersServed: 800,
      description: RICH, problem: RICH, solution: RICH, originality: RICH, innovation: RICH, targetMarket: "We plan to expand to two more states through partnerships with cooperatives and an offtake agreement.", mainCustomers: "Poultry farmers and schools", revenueSource: "Service fee of ₦2,000 per bag" });
    a.business.employees = { fullTime: 8, partTime: 4, youth: 6, women: 5 }; Object.assign(a.impact, { farmersReached: 900, jobsCreated: 12, communitiesReached: 9, socialImpact: RICH });
  });
  const thin = one((a) => {
    const t = "The idea is to help farmers in Nigeria with better ways of farming today.";
    Object.assign(a.business, { stage: "IDEA", yearStarted: null, registrationStatus: "NOT_REGISTERED", generatesRevenue: false, revenueRange: "NONE", customersServed: 0, description: t, problem: t, solution: t, originality: "", innovation: "", targetMarket: "", mainCustomers: "", revenueSource: "" });
    a.business.employees = { fullTime: 0, partTime: 0, youth: 0, women: 0 }; Object.assign(a.impact, { farmersReached: 0, jobsCreated: 0, communitiesReached: 0, socialImpact: "", environmentalImpact: "" });
    a.applicationId = "AGRA-2026-THINNN";
  });
  const [s, t] = preScreen([strong, thin]);
  assert.ok(s.total > t.total + 25, `${s.total} vs ${t.total}`);
  for (const p of [s, t]) { for (const v of Object.values(p.scores)) assert.ok(v >= 1 && v <= 10); assert.ok(p.total >= 0 && p.total <= 100); }
  assert.ok(s.strengths.length > 0 && t.weaknesses.length > 0);
});

test("text quality discounts repetition and gibberish", () => {
  assert.ok(textQuality(RICH) > textQuality("farm farm farm farm farm farm farm farm farm farm farm farm"));
  assert.ok(textQuality(RICH) > textQuality("xkcd qwrt plmnb vcxz trwq kjhg sdfg"));
  assert.equal(textQuality("too short"), 0);
});

test("copied answers are flagged and lose originality; the same person twice keeps only the stronger entry", () => {
  const text = Array(6).fill(RICH).join(" ");
  const [a, b] = variedApplications(2, 3);
  a.business.problem = b.business.problem = text; a.business.solution = b.business.solution = text;
  const [pa] = preScreen([a, b]);
  assert.ok(pa.flags.some((f) => /possible copy/.test(f)));
  const [c, d] = variedApplications(2, 5); d.applicant.email = c.applicant.email.toUpperCase();
  const out = preScreen([c, d]);
  assert.equal(out.filter((p) => p.duplicateOf).length, 1);
  assert.equal(out.filter((p) => p.eligible).length, out.filter((p) => !p.duplicateOf && p.ineligibleReasons.length === 0).length);
});

// ───────── shortlist and spread ─────────
const apps = variedApplications(3000);
const ranked = rankEligible(preScreen(apps), apps);
test("ranking is deterministic and in descending order", () => {
  assert.ok(ranked.length > 1300, `only ${ranked.length} eligible`);
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].total >= ranked[i].total);
  assert.deepEqual(rankEligible(preScreen(apps), apps).map((p) => p.applicationId), ranked.map((p) => p.applicationId));
});

test("batch of 500 from the top 1300: exact size, unique, every state kept, women and rural targets met", () => {
  const top = ranked.slice(0, 1300);
  const { picks, groups } = pickWithSpread(top, apps, 500);
  assert.equal(picks.length, 500); assert.equal(new Set(picks.map((p) => p.applicationId)).size, 500);
  const byId = new Map(apps.map((a) => [a.applicationId, a]));
  const chosen = picks.map((p) => byId.get(p.applicationId)!);
  for (const s of new Set(top.map((p) => byId.get(p.applicationId)!.location.state))) assert.ok(chosen.some((a) => a.location.state === s), `state ${s} missing`);
  assert.ok(chosen.filter((a) => a.applicant.gender === "FEMALE").length >= 150);
  assert.ok(chosen.filter((a) => a.inclusion.rural).length >= 100);
  for (const g of groups) assert.ok(g.got >= g.min, `${g.label}: ${g.got} < ${g.min}`);
  // Most places still go by rank: the top 300 of the shortlist are all in.
  const inBatch = new Set(picks.map((p) => p.applicationId));
  assert.ok(top.slice(0, 300).every((p) => inBatch.has(p.applicationId)));
});

// ───────── the service: batch → pass (limit 15) → move → judges ─────────
test("service: 500 shared between 10 reviewers; 15 passes each; moves keep done work; passed go to judges", async () => {
  const seed = variedApplications(1500, 11);
  mkdirSync(".data", { recursive: true });
  const staff = [...Array.from({ length: 10 }, (_, i) => ({ role: "REVIEWER", email: `rev${i}@example.org` })), ...Array.from({ length: 4 }, (_, i) => ({ role: "JUDGE", email: `judge${i}@example.org` }))]
    .map((s, i) => ({ userId: `U${i}`, name: s.email.split("@")[0], email: s.email, role: s.role, active: true, note: "", passwordHash: "", updatedAt: "2026-10-16T00:00:00Z", source: "sheet" }));
  writeFileSync(".data/dev-store.json", JSON.stringify({ applications: seed, drafts: [], events: [], staff, reviews: [] }));
  const S = await import("../lib/services/screeningService");
  const { getRepository } = await import("../lib/repository");
  const reviewerEmails = staff.filter((s) => s.role === "REVIEWER").map((s) => s.email);

  const preview = await S.createBatch({ shortlistSize: 1300, size: 500, reviewerEmails, dryRun: true }, "admin@example.org");
  assert.ok(preview.ok); assert.equal((preview as any).data.creates, 500); assert.equal((await getRepository().getReviews()).length, 0, "preview writes nothing");
  const done = await S.createBatch({ shortlistSize: 1300, size: 500, reviewerEmails, dryRun: false }, "admin@example.org");
  assert.ok(done.ok); assert.equal((done as any).data.added, 500);
  const b = await S.board("REVIEWER");
  assert.deepEqual(b.people.map((p) => p.assigned), Array(10).fill(50));
  const again = await S.createBatch({ shortlistSize: 1300, size: 500, reviewerEmails, dryRun: false }, "admin@example.org");
  assert.equal((again as any).data.creates, 0, "running again adds nothing");

  const user = (email: string): SessionUser => ({ id: email, name: email, email, role: "REVIEWER" });
  const r0 = b.people.find((p) => p.email === "rev0@example.org")!;
  for (const item of r0.items.slice(0, 15)) assert.ok((await S.setDecision(user(r0.email), item.applicationId, true)).ok);
  const sixteenth = await S.setDecision(user(r0.email), r0.items[15].applicationId, true);
  assert.equal(sixteenth.ok, false); assert.equal(sixteenth.status, 409);
  assert.equal((await S.setDecision(user("rev1@example.org"), r0.items[0].applicationId, true)).status, 404, "cannot pass someone else's");
  assert.ok((await S.setDecision(user(r0.email), r0.items[0].applicationId, false)).ok);
  assert.ok((await S.setDecision(user(r0.email), r0.items[15].applicationId, true)).ok, "after removing one, another can be passed");

  // Move everything of rev0 to rev1: the 15 passed stay, the other 35 move.
  const move = await S.moveReviews({ reviewIds: r0.items.map((i) => i.reviewId), to: "rev1@example.org" }, "admin@example.org");
  assert.ok(move.ok); assert.equal((move as any).data.moved, 35); assert.equal((move as any).data.skipped.length, 15);
  let after = await S.board("REVIEWER");
  assert.equal(after.people.find((p) => p.email === "rev0@example.org")!.assigned, 15);
  assert.equal(after.people.find((p) => p.email === "rev1@example.org")!.assigned, 85);
  // Share rev1's unfinished work evenly among the others; then move one back to rev1 (re-uses the withdrawn row).
  const r1 = after.people.find((p) => p.email === "rev1@example.org")!;
  const even = await S.moveReviews({ reviewIds: r1.items.slice(0, 80).map((i) => i.reviewId), to: "EVEN" }, "admin@example.org");
  assert.ok(even.ok); after = await S.board("REVIEWER");
  const loads = after.people.filter((p) => p.email !== "rev0@example.org" && p.email !== "rev1@example.org").map((p) => p.assigned);
  assert.ok(Math.max(...loads) - Math.min(...loads) <= 1, `uneven: ${loads}`);
  assert.equal(after.inRound, 500, "no application lost or duplicated");
  const someoneElse = after.people.find((p) => p.email === "rev2@example.org")!.items.find((i) => r1.items.some((x) => x.applicationId === i.applicationId))!;
  assert.ok((await S.moveReviews({ reviewIds: [someoneElse.reviewId], to: "rev1@example.org" }, "admin@example.org")).ok);
  assert.equal((await getRepository().getReviews()).filter((r) => r.applicationId === someoneElse.applicationId && r.panelEmail === "rev1@example.org").length, 1, "re-used, not duplicated");

  // CSVs
  const shortlist = await S.listCsv("shortlist", 1300);
  assert.equal(shortlist.rows, 1300); assert.ok(shortlist.csv.startsWith("﻿rank,application_id,first_name"));
  assert.equal((await S.listCsv("passed")).rows, 15);
  assert.equal((await S.listCsv("batch")).rows, 500);

  // Judges
  const j = await S.sendPassedToJudges({ perApplication: 2, dryRun: false }, "admin@example.org");
  assert.ok(j.ok); assert.equal((j as any).data.added, 30);
  assert.equal((await S.board("JUDGE")).inRound, 15);
});
