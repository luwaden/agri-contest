import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LEVEL2_COLUMNS, level2ReviewToRow, rowToLevel2Review } from "../lib/google-sheets/level2Schema";

process.chdir(mkdtempSync(path.join(tmpdir(), "l2review-test-")));
Object.assign(process.env, { DATA_BACKEND: "local", SESSION_SECRET: "x".repeat(40) });
delete process.env.NEXT_PUBLIC_DEMO_MODE; delete process.env.RESEND_API_KEY; delete process.env.GMAIL_USER;

const STATES = ["Kaduna", "Kaduna", "Kaduna", "Kaduna", "Niger", "Niger", "Niger", "Niger", "Nasarawa", "Nasarawa"];
const subs = STATES.map((state, i) => {
  const a = Object.fromEntries(LEVEL2_COLUMNS.map(([, k]) => [k, ""])) as any;
  return { ...a, level1Code: `AGRA-2026-AAAA${"ABCDEFGHJK"[i]}2`, submittedAt: `2026-10-25T10:0${i}:00Z`, level1Email: `a${i}@example.org`, businessName: `Farm ${i}`, state,
    contactName: `Owner ${i}`, phone: "08031234567", doc1: `stored:level-2/AGRA-2026-AAAA${"ABCDEFGHJK"[i]}2/l2-supporting-x${i}.pdf` };
});
const staff = [["Rev One", "rev1@example.org", "REVIEWER", true], ["Rev Two", "Rev2@Example.org", "REVIEWER", true], ["Judge", "judge@example.org", "JUDGE", true], ["Gone", "gone@example.org", "REVIEWER", false], ["Boss", "boss@example.org", "ADMIN", true]]
  .map(([name, email, role, active], i) => ({ userId: `U${i}`, name, email, role, active, note: "", passwordHash: "", updatedAt: "2026-10-19T00:00:00Z", source: "sheet" }));
mkdirSync(".data", { recursive: true });
writeFileSync(".data/dev-store.json", JSON.stringify({ applications: [], drafts: [], events: [], staff, mentors: [], reviews: [], level2: subs }));
const user = (email: string, role = "REVIEWER") => ({ id: email, name: email, email, role }) as any;
const full = { scores: { operating: 4, documents: 3, needs: 5, growth: 4, reach: 2 }, decision: "RECOMMEND", comment: "Strong, well documented rice processor." };

test("sheet row round trip keeps scores, decision and guarded text", () => {
  const r = { reviewId: "L2R-1", level1Code: "AGRA-2026-AAAAA2", reviewerEmail: "r@x.org", reviewerName: "=R", status: "SUBMITTED", assignedAt: "a", assignedBy: "b",
    scores: { operating: 4, reach: 1 }, total: 18, decision: "NOT_RECOMMEND", comment: "+line\nmore", updatedAt: "u", submittedAt: "s" } as any;
  const row = level2ReviewToRow(r); assert.ok(row[3].startsWith("'="));
  assert.deepEqual(rowToLevel2Review(row), r);
});

test("share evenly: active reviewers only, states mixed, nobody twice, preview saves nothing", async () => {
  const S = await import("../lib/services/level2ReviewService");
  const { getRepository } = await import("../lib/repository");
  assert.equal((await S.previewShare({ reviewers: ["gone@example.org"] })).status, 422, "inactive account refused");
  assert.equal((await S.previewShare({ reviewers: [] })).status, 422);
  const p = await S.previewShare({ reviewers: ["rev1@example.org", "rev2@example.org", "judge@example.org"], byState: true });
  assert.ok(p.ok); assert.deepEqual((p as any).data.perReviewer.map((x: any) => x.adding), [4, 3, 3]);
  assert.equal((await getRepository().getLevel2Reviews()).length, 0, "preview saves nothing");

  const c = await S.confirmShare({ reviewers: ["rev1@example.org", "REV2@example.org", "judge@example.org"], byState: true }, "boss@example.org");
  assert.deepEqual((c as any).data, { added: 10 });
  const rows = await getRepository().getLevel2Reviews();
  assert.equal(new Set(rows.map((r) => r.level1Code)).size, 10, "one reviewer per applicant");
  for (const email of ["rev1@example.org", "rev2@example.org", "judge@example.org"]) {
    const states = new Set(rows.filter((r) => r.reviewerEmail === email).map((r) => subs.find((s) => s.level1Code === r.level1Code)!.state));
    assert.ok(states.size >= 2, `${email} gets a mix of states`);
  }
  assert.equal((await S.confirmShare({ reviewers: ["rev1@example.org"] }, "boss@example.org")).status, 422, "nothing left to share");
});

test("reviewer: sees only their own, draft then submit with checks, then locked", async () => {
  const S = await import("../lib/services/level2ReviewService");
  const me = user("rev1@example.org");
  const mine = await S.myLevel2Reviews(me); assert.equal(mine.length, 4);
  const code = mine[0].submission.level1Code;
  const other = (await S.myLevel2Reviews(user("rev2@example.org")))[0].submission.level1Code;
  assert.equal((await S.saveMyLevel2Review(me, other, full)).status, 404, "not assigned to me");
  assert.equal(await S.myLevel2Review(me, other), null);

  const draft = await S.saveMyLevel2Review(me, code, { scores: { operating: 4, documents: 9 } });
  assert.ok(draft.ok); assert.deepEqual((draft as any).data.review.scores, { operating: 4 }, "out-of-range score ignored");
  assert.equal((draft as any).data.review.status, "IN_PROGRESS"); assert.equal((draft as any).data.review.total, null);

  const missing = await S.saveMyLevel2Review(me, code, { scores: { operating: 4 }, submit: true });
  assert.equal(missing.status, 422); assert.deepEqual(Object.keys((missing as any).body.errors).sort(), ["comment", "decision", "documents", "growth", "needs", "reach"]);

  const done = await S.saveMyLevel2Review(me, code, { ...full, submit: true });
  assert.ok(done.ok); assert.equal((done as any).data.review.total, 18); assert.equal((done as any).data.review.status, "SUBMITTED");
  assert.equal((await S.saveMyLevel2Review(me, code, full)).status, 409, "locked after submitting");
  assert.equal((await S.myLevel2Reviews(me))[3].submission.level1Code, code, "done ones go to the end of the list");
});

test("admin: move, remove and reopen; submitted reviews never move; history kept", async () => {
  const S = await import("../lib/services/level2ReviewService");
  const { getRepository } = await import("../lib/repository");
  const r1 = await S.myLevel2Reviews(user("rev1@example.org"));
  const submitted = r1.find((x) => x.review.status === "SUBMITTED")!.submission.level1Code;
  const open = r1.find((x) => x.review.status !== "SUBMITTED")!.submission.level1Code;

  const m = await S.moveTo({ codes: [submitted, open], to: "rev2@example.org" }, "boss@example.org");
  assert.equal((m as any).data.moved, 1); assert.match((m as any).data.skipped[0], /already reviewed/);
  assert.ok((await S.myLevel2Review(user("rev2@example.org"), open)), "now with Rev Two");
  assert.equal(await S.myLevel2Review(user("rev1@example.org"), open), null, "and no longer with Rev One");
  const hist = (await getRepository().getLevel2Reviews()).filter((r) => r.level1Code === open);
  assert.deepEqual(hist.map((r) => r.status), ["WITHDRAWN", "ASSIGNED"], "old row kept as WITHDRAWN");
  assert.equal((await S.moveTo({ codes: [open], to: "nobody@example.org" }, "boss@example.org")).status, 422);

  const u = await S.unassign({ codes: [open, submitted] }, "boss@example.org");
  assert.equal((u as any).data.removed, 1); assert.equal((await S.level2ReviewOverview()).rows.find((r) => r.code === open)!.review, null);

  assert.equal((await S.reopen({ code: open }, "boss@example.org")).status, 422);
  assert.ok((await S.reopen({ code: submitted }, "boss@example.org")).ok);
  const again = await S.saveMyLevel2Review(user("rev1@example.org"), submitted, { ...full, decision: "NOT_RECOMMEND", submit: true });
  assert.equal((again as any).data.review.decision, "NOT_RECOMMEND", "the reviewer could change it after reopening");

  const o = await S.level2ReviewOverview();
  assert.deepEqual(o.stats, { submitted: 10, assigned: 9, reviewed: 1, recommended: 0 });
  const csv = (await S.level2ReviewCsv()).csv;
  assert.ok(csv.includes("Do not recommend") && csv.includes("NOT_ASSIGNED") && csv.includes("total_out_of_25"));
});

test("files: a reviewer opens only the documents of their own applicants", async () => {
  const S = await import("../lib/services/level2ReviewService");
  const me = user("rev2@example.org");
  const mine = (await S.myLevel2Reviews(me))[0].submission;
  const theirs = (await S.myLevel2Reviews(user("judge@example.org")))[0].submission;
  assert.equal(await S.level2ReviewerMayOpen(me, mine.doc1), true);
  assert.equal(await S.level2ReviewerMayOpen(me, theirs.doc1), false);
  assert.equal(await S.level2ReviewerMayOpen(user("boss@example.org", "ADMIN"), mine.doc1), false, "admins use their own permission, not this one");
});

test("switch: Level 2 scoring off locks saving, assigning still works", async () => {
  const F = await import("../lib/features");
  const S = await import("../lib/services/level2ReviewService");
  await F.setFeature("level2Scoring", false, "boss@example.org");
  try {
    const code = (await S.myLevel2Reviews(user("judge@example.org")))[0].submission.level1Code;
    const r = await S.saveMyLevel2Review(user("judge@example.org"), code, full);
    assert.equal(r.status, 503); assert.equal((r as any).body.code, "FEATURE_OFF");
    assert.ok((await S.previewShare({ reviewers: ["rev1@example.org"] })).ok);
  } finally { await F.setFeature("level2Scoring", true, "boss@example.org"); }
});
