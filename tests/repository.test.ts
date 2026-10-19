import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { HEADERS, SHEETS } from "../lib/google-sheets/schema";
import { validateAll } from "../lib/validation/application";
import { toApplication } from "../lib/mapper";
import { loadAppsScript } from "./helpers/fakeGoogle";
import { sample } from "./fixtures";
import type { ApplicationRepository } from "../lib/repository/types";
import type { SheetTransport } from "../lib/google-sheets/transport";

process.chdir(mkdtempSync(path.join(os.tmpdir(), "repo-test-")));   // LocalRepository writes under ./.data

const mk = (id: string, o: Record<string, unknown> = {}) =>
  toApplication(validateAll({ ...sample, declaration: true, ...o }).data, { applicationId: id, status: "SUBMITTED", now: new Date("2026-10-05T10:00:00Z") });

// ── 1. the script itself ──
test("Code.gs headers are generated from the app's schema (cannot drift)", () => {
  const { sandbox } = loadAppsScript();
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.TABS)), JSON.parse(JSON.stringify(HEADERS)));
});
test("setup() creates every tab with its header row and removes the blank default tab", () => {
  const { sandbox, ss } = loadAppsScript(); sandbox.setup();
  for (const [name, headers] of Object.entries(HEADERS)) assert.deepEqual(ss.getSheetByName(name)!.grid[0], [...headers], name);
  assert.equal(ss.getSheetByName("Sheet1"), null);
});
test("script rejects wrong secret, unknown tabs, and writes to the header row", () => {
  const { sandbox, post } = loadAppsScript(); sandbox.setup();
  assert.equal(post({ secret: "nope", action: "read", sheet: "Applications" }).error, "forbidden");
  assert.equal(post({ secret: "test-secret", action: "read", sheet: "Passwords" }).error, "unknown sheet");
  assert.match(post({ secret: "test-secret", action: "updateRow", sheet: "Applications", rowNumber: 1, row: ["x"] }).error, /bad row/);
  assert.match(post({ secret: "test-secret", action: "clearRow", sheet: "Applications", rowNumber: 1, width: 5 }).error, /bad row/);
  assert.equal(post({ secret: "test-secret", action: "explode", sheet: "Applications" }).error, "unknown action");
});
test("script stores text exactly: dates, +phone numbers and =formulas survive", () => {
  const { sandbox, post } = loadAppsScript(); sandbox.setup();
  const row = ["AGRA-2026-AAAAAA", "1998-04-12", "+2348031234567", "=HYPERLINK(\"x\")", "08031234567", "multi\nline"];
  post({ secret: "test-secret", action: "append", sheet: "Applications", row });
  assert.deepEqual(post({ secret: "test-secret", action: "read", sheet: "Applications" }).rows[1].slice(0, 6), row);
});

// ── 2. the same behaviour from every storage option ──
class FakeRest implements SheetTransport {          // behaves like the Sheets REST API: ragged rows, trailing blanks dropped
  tabs = new Map<string, string[][]>(Object.entries(HEADERS).map(([k, v]) => [k, [[...v]]]));
  async read(s: string) { return (this.tabs.get(s) ?? []).map((r) => { const c = [...r]; while (c.length && c[c.length - 1] === "") c.pop(); return c; }); }
  async append(s: string, row: string[]) { this.tabs.get(s)!.push([...row]); }
  async updateRow(s: string, n: number, row: string[]) { this.tabs.get(s)![n - 1] = [...row]; }
  async clearRow(s: string, n: number, w: number) { this.tabs.get(s)![n - 1] = new Array(w).fill(""); }
  async updateRows(s: string, rows: Array<{ rowNumber: number; row: string[] }>) { for (const r of rows) this.tabs.get(s)![r.rowNumber - 1] = [...r.row]; }
}

async function contract(name: string, repo: ApplicationRepository) {
  const a = mk("AGRA-2026-AAAAA2", { state: "Kaduna", email: "k@example.com", description: "=SUM(1+1) maize aggregation hub for smallholders" });
  await repo.createApplication(a);
  await assert.rejects(() => repo.createApplication(a), /DUPLICATE_ID/, `${name}: duplicate id`);
  await repo.createApplication(mk("AGRA-2026-AAAAA3", { state: "Lagos", email: "l@example.com" }));
  const all = await repo.getApplications(); assert.equal(all.length, 2, `${name}: count`);
  const got = (await repo.getApplicationById("AGRA-2026-AAAAA2"))!;
  assert.equal(got.applicant.dateOfBirth, "1998-04-12", `${name}: date of birth text`); assert.equal(got.applicant.phone, a.applicant.phone, `${name}: phone`);
  assert.equal(got.business.description, a.business.description, `${name}: formula-like text`); assert.equal(got.location.state, "Kaduna");
  assert.equal(await repo.getApplicationById("AGRA-2026-NOPE22"), null);
  const upd = await repo.updateStatus("AGRA-2026-AAAAA2", "SHORTLISTED", "tester"); assert.equal(upd!.submissionStatus, "SHORTLISTED");
  assert.equal((await repo.getApplicationById("AGRA-2026-AAAAA2"))!.submissionStatus, "SHORTLISTED", `${name}: status persisted`);
  assert.equal((await repo.getApplicationById("AGRA-2026-AAAAA3"))!.submissionStatus, "SUBMITTED", `${name}: other rows untouched`);
  assert.ok((await repo.getEvents()).some((e) => e.action === "STATUS_CHANGED" && e.actor === "tester"), `${name}: audit event`);
  // drafts
  await repo.saveDraft({ tokenHash: "h1", email: "d@example.com", updatedAt: "2026-10-05T10:00:00Z", stage: 1, values: { firstName: "Draft" } });
  await repo.saveDraft({ tokenHash: "h1", email: "d@example.com", updatedAt: "2026-10-05T10:05:00Z", stage: 2, values: { firstName: "Draft2" } });
  assert.equal(await repo.countDrafts(), 1, `${name}: draft upsert`); const d = (await repo.getDraft("h1"))!; assert.equal(d.stage, 2); assert.equal((d.values as any).firstName, "Draft2");
  await repo.deleteDraft("h1"); assert.equal(await repo.getDraft("h1"), null); assert.equal(await repo.countDrafts(), 0, `${name}: draft deleted`);
  await repo.createApplication(mk("AGRA-2026-AAAAA4", { email: "m@example.com" })); assert.equal((await repo.getApplications()).length, 3, `${name}: append after cleared draft row`);
  // mentors
  const m = { mentorId: "MNTR-2026-AAAAA2", status: "NEW" as const, submittedAt: "2026-10-05T10:00:00Z", updatedAt: "2026-10-05T10:00:00Z", fullName: "Ada Obi", firstName: "Ada", lastName: "Obi", email: "ada@example.com", phone: "+2348031234567", state: "Lagos", location: "Ikeja", profession: "Banker", organization: "AgriBank", industry: "Banking", yearsExperience: 12, mentorshipExperience: "Some", expertise: ["FINANCE", "MARKETING"], availability: "2_5", availabilityNotes: "", linkedin: "", portfolio: "", motivation: "Help founders", documents: [], consent: true, source: "web" };
  await repo.createMentor(m); await assert.rejects(() => repo.createMentor(m), /DUPLICATE_ID/);
  const gm = (await repo.getMentorById("MNTR-2026-AAAAA2"))!; assert.deepEqual([gm.fullName, gm.firstName, gm.lastName, gm.phone, gm.expertise], ["Ada Obi", "Ada", "Obi", "+2348031234567", ["FINANCE", "MARKETING"]], `${name}: mentor round trip`);
  assert.equal((await repo.updateMentorStatus("MNTR-2026-AAAAA2", "ACCEPTED", "tester"))!.status, "ACCEPTED"); assert.equal((await repo.getMentors()).length, 1);
  // panel reviews (assignments + score sheets)
  assert.deepEqual(await repo.getReviews(), [], `${name}: no reviews yet`);
  const rv = (id: string, app: string, email: string) => ({ reviewId: id, applicationId: app, panelEmail: email, panelName: "=Rev " + id, panelRole: "REVIEWER" as const, status: "ASSIGNED" as const,
    assignedAt: "2026-10-10T10:00:00Z", assignedBy: "admin@example.org", scores: {}, comments: {}, overallComment: "", total: null, conflictNote: "", updatedAt: "2026-10-10T10:00:00Z", submittedAt: null, decision: null });
  assert.equal(await repo.createReviews([rv("RV-1", "AGRA-2026-AAAAA2", "r1@example.org"), rv("RV-2", "AGRA-2026-AAAAA2", "r2@example.org"), rv("RV-3", "AGRA-2026-AAAAA3", "r1@example.org")]), 3, `${name}: reviews created`);
  assert.equal(await repo.createReviews([rv("RV-9", "AGRA-2026-AAAAA2", "r1@example.org"), rv("RV-4", "AGRA-2026-AAAAA4", "r2@example.org")]), 1, `${name}: same person + application is never added twice`);
  const sub = await repo.updateReview("RV-2", { status: "SUBMITTED", scores: { originality: 8, feasibility: 7, scalability: 6, impact: 9, market: 5 }, comments: { market: "=thin, evidence" }, overallComment: "Strong idea; needs buyers.\nSecond line", total: 71, submittedAt: "2026-10-11T09:00:00Z" });
  assert.equal(sub!.status, "SUBMITTED");
  const back = (await repo.getReviews()).find((r) => r.reviewId === "RV-2")!;
  assert.deepEqual([back.scores, back.comments, back.overallComment, back.total, back.panelName, back.applicationId, back.panelEmail],
    [{ originality: 8, feasibility: 7, scalability: 6, impact: 9, market: 5 }, { market: "=thin, evidence" }, "Strong idea; needs buyers.\nSecond line", 71, "=Rev RV-2", "AGRA-2026-AAAAA2", "r2@example.org"], `${name}: score sheet round trip`);
  assert.equal((await repo.getReviews()).find((r) => r.reviewId === "RV-1")!.status, "ASSIGNED", `${name}: other review rows untouched`);
  assert.equal(await repo.updateReview("RV-NOPE", { status: "WITHDRAWN" }), null);
  assert.equal((await repo.getReviews()).length, 4, `${name}: review count`);
  // batch updates (moves, passes)
  const many = await repo.updateReviews([{ reviewId: "RV-1", patch: { status: "WITHDRAWN" } }, { reviewId: "RV-3", patch: { decision: "PASS" } }, { reviewId: "RV-NOPE", patch: { status: "WITHDRAWN" } }]);
  assert.equal(many.length, 2, `${name}: unknown ids skipped`);
  const after = await repo.getReviews();
  assert.deepEqual([after.find((r) => r.reviewId === "RV-1")!.status, after.find((r) => r.reviewId === "RV-3")!.decision, after.find((r) => r.reviewId === "RV-2")!.total, after.find((r) => r.reviewId === "RV-4")!.decision],
    ["WITHDRAWN", "PASS", 71, null], `${name}: batch update round trip, others untouched`);
  // messages (append-only)
  const camp = { campaignId: "MSG-1", createdAt: "2026-10-19T10:00:00Z", createdBy: "a@example.org", subject: "=Hello {first_name}", body: "#Heading\nLine 1\n\nLine 2, \"quoted\"", audience: "Passed (2)", recipientIds: ["AGRA-2026-AAAAA2", "AGRA-2026-AAAAA3"] };
  await repo.createEmailCampaign(camp);
  assert.deepEqual(await repo.getEmailCampaigns(), [camp], `${name}: campaign round trip`);
  await repo.appendEmailLog([{ at: "2026-10-19T10:01:00Z", campaignId: "MSG-1", applicationId: "AGRA-2026-AAAAA2", email: "k@example.com", status: "SENT", detail: "em_1" }, { at: "2026-10-19T10:01:01Z", campaignId: "MSG-1", applicationId: "AGRA-2026-AAAAA3", email: "l@example.com", status: "FAILED", detail: "-TIMEOUT" }]);
  const lg = await repo.getEmailLog(); assert.equal(lg.length, 2); assert.equal(lg[1].detail, "-TIMEOUT", `${name}: log round trip (guarded text)`);
}

test("repository contract: local JSON store", async () => { const { LocalRepository } = await import("../lib/repository/local"); await contract("local", new LocalRepository()); });
test("repository contract: Google Sheets (REST-style transport)", async () => { const { SheetsRepository } = await import("../lib/google-sheets/applications"); await contract("sheets", new SheetsRepository(new FakeRest())); });
test("repository contract: Apps Script inside the sheet (over HTTP, incl. redirect)", async () => {
  const { SheetsRepository } = await import("../lib/google-sheets/applications"); const { AppsScriptTransport } = await import("../lib/google-sheets/appsScript");
  const g = loadAppsScript("s3cret-value-0123456789abcdef"); g.sandbox.setup();
  // Apps Script answers a POST with a 302 to a different URL that serves the JSON, so mimic that exactly.
  let last = ""; const server = http.createServer((req, res) => {
    if (req.url === "/exec" && req.method === "POST") { const c: Buffer[] = []; req.on("data", (x) => c.push(x)); req.on("end", () => { last = g.sandbox.doPost({ postData: { contents: Buffer.concat(c).toString() } }).getContent(); res.writeHead(302, { Location: "/echo" }); res.end(); }); }
    else if (req.url === "/echo") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(last); } else { res.writeHead(404); res.end(); }
  });
  await new Promise<void>((r) => server.listen(0, r)); const port = (server.address() as any).port;
  process.env.APPS_SCRIPT_URL = `http://localhost:${port}/exec`; process.env.APPS_SCRIPT_SECRET = "s3cret-value-0123456789abcdef";
  try {
    await contract("appsscript", new SheetsRepository(new AppsScriptTransport()));
    process.env.APPS_SCRIPT_SECRET = "wrong";
    await assert.rejects(() => new AppsScriptTransport().read(SHEETS.applications), /forbidden/);   // wrong secret is refused end to end
  } finally { server.close(); }
});
