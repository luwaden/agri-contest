import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { preScreen, rankEligible } from "../lib/screening";
import { buildList, parseRequest, listSpecSchema, isFocal } from "../lib/screening/customList";
import { FOCAL_STATES } from "../config/admin";
import { variedApplications } from "./helpers/varied";

process.chdir(mkdtempSync(path.join(tmpdir(), "screen-assist-test-")));
Object.assign(process.env, { DATA_BACKEND: "local" });
delete process.env.NEXT_PUBLIC_DEMO_MODE; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL; delete process.env.ADMIN_USERS_JSON; delete process.env.AI_PROVIDER;

// Test data with a realistic focal share (~45%), women ~35%, some PWD.
const apps = variedApplications(6000, 21).map((a, i) => { if (i % 20 < 9) a.location.state = FOCAL_STATES[i % 3]; if (i % 37 === 0) a.inclusion.disability = "YES"; else a.inclusion.disability = "NO"; return a; });
const ranked = rankEligible(preScreen(apps), apps);
const byId = new Map(apps.map((a) => [a.applicationId, a]));
const spec = (o: Record<string, unknown>) => listSpecSchema.parse({ size: 1300, ...o });

test("the request from the programme team is read correctly", () => {
  const r = parseRequest("send the csv file of the best most eligible 1300 candidates, 60% solid applications from focal state  40% from the other states , 20% women and pwd", { size: 1300 });
  assert.deepEqual([r.spec.size, r.spec.focalShare, r.spec.otherShare, r.spec.minWomenShare, r.spec.minPwdShare, r.spec.minimumsWithinFirst], [1300, 0.6, 0.4, 0.2, null, null]);
  const r2 = parseRequest("top 500 with 30% women and 5% PWD in the first 300", { size: 1300 });
  assert.deepEqual([r2.spec.size, r2.spec.minWomenShare, r2.spec.minPwdShare, r2.spec.minimumsWithinFirst], [500, 0.3, 0.05, 300]);
  assert.equal(parseRequest("best 1,300", { size: 10 }).spec.size, 1300);
});

test("1300 = exactly 780 focal + 520 other, at least 20% women, and otherwise strictly the best", () => {
  const r = buildList(ranked, apps, spec({ focalShare: 0.6, otherShare: 0.4, minWomenShare: 0.2 }));
  const list = r.rows.map((x) => byId.get(x.applicationId)!);
  assert.equal(list.length, 1300); assert.equal(new Set(r.rows.map((x) => x.applicationId)).size, 1300);
  assert.equal(list.filter(isFocal).length, 780); assert.equal(r.counts.focal, 780); assert.equal(r.counts.other, 520);
  assert.ok(r.counts.women >= 260);
  // Within each group, nobody left out scores higher than someone included (except places used for a minimum).
  for (const focal of [true, false]) {
    const inc = r.rows.filter((x) => isFocal(byId.get(x.applicationId)!) === focal && x.placedBy !== "Minimum: women");
    const worst = Math.max(...inc.map((x) => x.overallRank));
    const taken = new Set(r.rows.map((x) => x.applicationId));
    const better = ranked.slice(0, worst).filter((p) => isFocal(byId.get(p.applicationId)!) === focal && !taken.has(p.applicationId));
    assert.equal(better.length, 0, `group focal=${focal}: a better applicant was left out`);
  }
});

test("minimums inside the first 300 are met by moving people up, and the location shares stay exact", () => {
  const r = buildList(ranked, apps, spec({ focalShare: 0.6, otherShare: 0.4, minWomenShare: 0.45, minPwdShare: 0.05, minimumsWithinFirst: 300 }));
  assert.ok(r.scope!.women >= 135, `women in first 300: ${r.scope!.women}`); assert.ok(r.scope!.pwd >= 15, `pwd in first 300: ${r.scope!.pwd}`);
  assert.equal(r.counts.focal, 780); assert.equal(r.counts.total, 1300);
  assert.deepEqual(r.rows.map((x) => x.position), Array.from({ length: 1300 }, (_, i) => i + 1));
});

test("an impossible request says so instead of pretending", () => {
  const r = buildList(ranked, apps, spec({ size: 1300, minPwdShare: 0.9 }));
  assert.ok(r.notes.some((n) => /Could reach only \d+ persons with disability/.test(n)), r.notes.join(" | "));
  const small = buildList(ranked, apps, spec({ size: 1300, states: ["Kaduna"] }));
  assert.ok(small.counts.total < 1300 && small.notes.some((n) => /Only \d+ eligible applicants match/.test(n)));
  assert.equal(listSpecSchema.safeParse({ size: 100, focalShare: 0.7, otherShare: 0.5 }).success, false, "shares over 100% are refused");
});

test("assistant: lists, counts, proposed moves (nothing written until confirmed), and the AI only ever sees the sentence", async () => {
  mkdirSync(".data", { recursive: true });
  const staff = Array.from({ length: 4 }, (_, i) => ({ userId: `U${i}`, name: `Reviewer ${i + 1}`, email: `r${i + 1}@example.org`, role: "REVIEWER", active: true, note: "", passwordHash: "", updatedAt: "2026-10-16T00:00:00Z", source: "sheet" }));
  writeFileSync(".data/dev-store.json", JSON.stringify({ applications: apps.slice(0, 2000), drafts: [], events: [], staff, reviews: [] }));
  const A = await import("../lib/services/screeningAssistant");
  const S = await import("../lib/services/screeningService");
  const { getRepository } = await import("../lib/repository");

  const list = await A.ask({ text: "send the csv of the best 600, 60% focal states, 40% other states, 20% women" });
  assert.equal(list.kind, "list");
  if (list.kind === "list") { assert.equal(list.report.counts.total, 600); assert.equal(list.report.counts.focal, 360); assert.equal(list.source, "rules"); }
  const csv = await A.customListCsv(list.kind === "list" ? list.spec : null);
  assert.equal(csv.rows, 600); assert.ok(csv.csv.includes("position,overall_rank,application_id,location_group,pwd,placed_by"));
  await assert.rejects(() => A.customListCsv({ size: -1 }), "a tampered spec is refused");

  await S.createBatch({ shortlistSize: 1000, size: 200, reviewerEmails: staff.map((s) => s.email), dryRun: false }, "admin@example.org");
  const ans = await A.ask({ text: "How many women and PWD are in the batch?" });
  assert.equal(ans.kind, "answer"); if (ans.kind === "answer") assert.equal(ans.lines[0][1], "200");

  const before = JSON.stringify(await getRepository().getReviews());
  const move = await A.ask({ text: "Move Reviewer 2's unfinished work to the other reviewers" });
  assert.equal(move.kind, "action");
  assert.equal(JSON.stringify(await getRepository().getReviews()), before, "a proposal writes nothing");
  if (move.kind === "action") {
    assert.equal((move.confirm.reviewIds as string[]).length, 50); assert.equal(move.confirm.to, "EVEN");
    const done = await S.moveReviews(move.confirm, "admin@example.org");   // what the Confirm button does
    assert.ok(done.ok); assert.equal((await S.board("REVIEWER")).people.find((p) => p.email === "r2@example.org")!.assigned, 0);
  }
  assert.equal((await A.ask({ text: "Move Nobody's work to Reviewer 1" })).kind, "unclear");

  // AI on: it receives only the sentence (no names, emails or scores) and its settings are validated.
  Object.assign(process.env, { AI_PROVIDER: "claude", ANTHROPIC_API_KEY: "test", ANTHROPIC_MODEL: "test-model" });
  const sent: string[] = []; const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
    if (String(url).includes("/v1/messages")) { sent.push(init?.body ?? ""); return new Response(JSON.stringify({ content: [{ type: "text", text: '{"size":400,"focalShare":0.5,"otherShare":0.5,"minWomenShare":0.25,"minPwdShare":null,"minRuralShare":null,"minimumsWithinFirst":null,"states":[],"valueChains":[]}' }] }), { status: 200 }); }
    return realFetch(url as string, init as RequestInit);
  }) as typeof fetch;
  try {
    const viaAi = await A.ask({ text: "give me four hundred, half focal half not, quarter women" });
    assert.equal(viaAi.kind, "list"); if (viaAi.kind === "list") { assert.equal(viaAi.source, "ai"); assert.equal(viaAi.report.counts.total, 400); assert.equal(viaAi.report.counts.focal, 200); }
    assert.equal(sent.length, 1);
    for (const leak of [apps[0].applicant.email, apps[0].applicant.firstName, apps[0].business.businessName, "@example.invalid"]) assert.ok(!sent[0].includes(leak), `AI request contained ${leak}`);
    globalThis.fetch = (async () => new Response("{}", { status: 500 })) as typeof fetch;   // AI down → rules still work
    const fallback = await A.ask({ text: "best 300, 20% women" });
    assert.equal(fallback.kind === "list" && fallback.source, "rules");
  } finally { globalThis.fetch = realFetch; delete process.env.AI_PROVIDER; }
});

// ───────── balanced selection: "60 each from Kaduna, Niger, Nasarawa, 20% women, 10% PWD, mixed ages, LGA spread" ─────────
test("balanced selection: exact numbers per state, minimums met, LGAs spread, ages mixed, best otherwise", async () => {
  const { balancedSelect, ageBand } = await import("../lib/screening/balanced");
  const { parseBalanced } = await import("../lib/screening/customList");
  const data = variedApplications(4000, 33).map((a, i) => {
    a.location.state = ["Kaduna", "Niger", "Nasarawa", "Lagos"][i % 4]; a.location.lga = `LGA ${i % 13}`;
    a.inclusion.disability = i % 23 === 0 ? "YES" : "NO"; a.applicant.gender = i % 9 === 0 ? "FEMALE" : "MALE";   // few women, few PWD: the minimums must do work
    return a;
  });
  const rk = rankEligible(preScreen(data), data); const by = new Map(data.map((a) => [a.applicationId, a]));
  const spec = parseBalanced("currently we need 180 people (60 people each from kaduna, niger, nassarawa only), 20% women  included, Pwds 10%, Mix the age demography, the gender too, and the LGA spread for representation")!;
  assert.deepEqual(spec.perState, { Kaduna: 60, Niger: 60, Nasarawa: 60 });
  const r = balancedSelect(rk, data, spec);
  assert.equal(r.rows.length, 180); assert.equal(new Set(r.rows.map((x) => x.applicationId)).size, 180);
  for (const s of r.byState) {
    assert.equal(s.got, 60, s.state);
    assert.ok(s.women >= 12, `${s.state} women ${s.women}`); assert.ok(s.pwd >= 6, `${s.state} pwd ${s.pwd}`);
    assert.equal(s.lgas, s.lgasAvailable, `${s.state}: every LGA represented`);
    for (const band of ["18–24", "25–29", "30–35"]) assert.ok((s.ages[band] ?? 0) >= 9 || r.notes.some((n) => n.includes(`age ${band}`)), `${s.state} ${band}`);
    const perLga = new Map<string, number>(); for (const x of r.rows.filter((y) => y.state === s.state)) perLga.set(x.lga, (perLga.get(x.lga) ?? 0) + 1);
    assert.ok(Math.max(...perLga.values()) <= 15, `${s.state}: one LGA took ${Math.max(...perLga.values())} places`);
  }
  assert.ok(r.rows.every((x) => by.get(x.applicationId)!.location.state !== "Lagos"), "only the named states");
  // Nobody placed "by rank" in a state is weaker than someone left out of that state, unless a rule needed that place.
  for (const st of ["Kaduna", "Niger", "Nasarawa"]) {
    const picked = new Set(r.rows.filter((x) => x.state === st).map((x) => x.applicationId));
    const worstByRank = Math.max(...r.rows.filter((x) => x.state === st && x.placedBy === "Rank").map((x) => x.overallRank));
    const better = rk.slice(0, worstByRank).filter((p) => by.get(p.applicationId)!.location.state === st && !picked.has(p.applicationId)).length;
    assert.ok(better <= 15, `${st}: ${better} stronger applicants left out`);   // only those displaced by the LGA cap / minimums
  }
  void ageBand;
  // Not enough PWD: said plainly.
  const few = balancedSelect(rk, data, { ...spec, minPwdShare: 0.9 });
  assert.ok(few.notes.some((n) => /persons with disability \(wanted at least 54\)/.test(n)), few.notes.join(" | "));
});
