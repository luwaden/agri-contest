import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { variedApplications } from "./helpers/varied";
import { can } from "../lib/auth/permissions";

// Own process: throw-away local store and a fake Resend (no real email is sent).
process.chdir(mkdtempSync(path.join(tmpdir(), "messages-test-")));
Object.assign(process.env, { DATA_BACKEND: "local", RESEND_API_KEY: "re_test", EMAIL_FROM: "Youth Agri-Innovation Contest <apply@example.org>", EMAIL_DAILY_LIMIT: "1000" });
delete process.env.GMAIL_USER; delete process.env.NEXT_PUBLIC_DEMO_MODE; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL;

type Sent = { to: string[]; subject: string; html: string; text: string; key: string | null };
const sent: Sent[] = []; let failFor: string | null = null;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: unknown, init?: { body?: string; headers?: Record<string, string> }) => {
  if (String(url).startsWith("https://api.resend.com/")) {
    const b = JSON.parse(init!.body!);
    if (failFor && b.to[0] === failFor) return new Response(JSON.stringify({ message: "server busy" }), { status: 500 });
    sent.push({ ...b, key: init?.headers?.["Idempotency-Key"] ?? null });
    return new Response(JSON.stringify({ id: `em_${sent.length}` }), { status: 200 });
  }
  return realFetch(url as string, init as RequestInit);
}) as typeof fetch;

const apps = variedApplications(60, 8);
apps[0].applicant.firstName = `<b>Amina</b>`;                     // must arrive escaped
apps[1].applicant.email = apps[2].applicant.email.toUpperCase();   // same person twice → one email
apps[3].submissionStatus = "DRAFT";                                 // never emailed
apps[4].applicant.email = "not-an-address";                         // bad address: never retried
apps.forEach((a, i) => { a.submissionStatus = i === 3 ? "DRAFT" : i < 50 ? "SHORTLISTED" : "SUBMITTED"; });
mkdirSync(".data", { recursive: true });
writeFileSync(".data/dev-store.json", JSON.stringify({ applications: apps, drafts: [], events: [], staff: [], reviews: [] }));

const msg = { subject: "Good news, {first_name}", heading: "", body: "Dear {first_name},\n\nYour business {business_name} ({application_id}) is shortlisted.\n\nThe team" };
const shortlisted = { kind: "status", status: "SHORTLISTED" };

test("only administrators can send messages", () => {
  assert.equal(can("ADMIN", "email:send"), true);
  for (const r of ["COORDINATOR", "JUDGE", "REVIEWER"] as const) assert.equal(can(r, "email:send"), false);
});

test("preview: right people, fill-ins filled and escaped, unknown fill-ins refused", async () => {
  const S = await import("../lib/services/emailCampaignService");
  const p = await S.preview({ ...msg, audience: shortlisted });
  assert.ok(p.ok); const d = (p as any).data;
  assert.equal(d.count, 48, "50 shortlisted − 1 draft − 1 duplicate email");
  assert.equal(d.email.subject, "Good news, <b>Amina</b>");
  assert.ok(d.email.html.includes("&lt;b&gt;Amina&lt;/b&gt;") && !d.email.html.includes("<b>Amina</b>"), "name is escaped in the HTML");
  assert.ok(d.email.html.includes(apps[0].applicationId));
  const bad = await S.preview({ ...msg, body: "Hello {firstname}, welcome aboard!", audience: shortlisted });
  assert.equal(bad.ok, false); assert.match((bad as any).body.message, /Unknown fill-in: \{firstname\}/);
  const pasted = await S.preview({ ...msg, audience: { kind: "pasted", text: `${apps[10].applicationId}, ${apps[11].applicant.email}\nAGRA-2026-NOPE99` } });
  assert.equal((pasted as any).data.count, 2); assert.deepEqual((pasted as any).data.notFound, ["AGRA-2026-NOPE99"]);
});

test("a test goes only to the administrator", async () => {
  const S = await import("../lib/services/emailCampaignService");
  sent.length = 0;
  const r = await S.sendTest({ ...msg, audience: shortlisted }, "admin@example.org");
  assert.ok(r.ok); assert.equal(sent.length, 1); assert.deepEqual(sent[0].to, ["admin@example.org"]); assert.match(sent[0].subject, /^\[TEST\] /);
});

test("sending: in batches, everyone once, daily limit respected, bad address not retried, repeat sends nothing", async () => {
  const S = await import("../lib/services/emailCampaignService");
  sent.length = 0; process.env.EMAIL_DAILY_LIMIT = "30";
  const c = await S.createCampaign({ ...msg, audience: shortlisted }, "admin@example.org");
  assert.ok(c.ok); const id = (c as any).data.campaign.campaignId as string;
  let r = await S.sendBatch(id, "admin@example.org"); assert.ok(r.ok);
  r = await S.sendBatch(id, "admin@example.org");                     // reaches the limit of 30 attempts today
  r = await S.sendBatch(id, "admin@example.org");
  assert.equal((r as any).data.stopped, "DAILY_LIMIT");
  assert.ok(sent.length <= 30);
  process.env.EMAIL_DAILY_LIMIT = "1000";                              // "the next day"
  failFor = apps[20].applicant.email;                                   // one temporary failure
  for (let i = 0; i < 10 && !(r as any).data.done; i++) r = await S.sendBatch(id, "admin@example.org");
  failFor = null;
  for (let i = 0; i < 5 && !(r as any).data.done; i++) r = await S.sendBatch(id, "admin@example.org");
  assert.equal((r as any).data.done, true);
  const to = sent.map((s) => s.to[0].toLowerCase());
  assert.equal(new Set(to).size, to.length, "nobody got it twice");
  assert.equal(to.length, 47, "48 people minus the bad address");
  assert.ok(to.includes(apps[20].applicant.email.toLowerCase()), "a temporary failure is retried");
  assert.ok(!to.includes("not-an-address"));
  assert.equal(new Set(sent.map((s) => s.key)).size, sent.length, "unique idempotency key per email");
  const before = sent.length; await S.sendBatch(id, "admin@example.org"); assert.equal(sent.length, before, "a finished message sends nothing more");
  const list = await S.listCampaigns(); const v = list.campaigns.find((x) => x.campaignId === id)!;
  assert.deepEqual([v.total, v.sent, v.remaining], [48, 47, 0]);
});

test("cancel stops a message part-way", async () => {
  const S = await import("../lib/services/emailCampaignService");
  sent.length = 0;
  const c = await S.createCampaign({ ...msg, subject: "Second {first_name}", audience: shortlisted }, "admin@example.org");
  const id = (c as any).data.campaign.campaignId as string;
  await S.sendBatch(id, "admin@example.org"); const n = sent.length;
  await S.cancelCampaign(id, "admin@example.org");
  const r = await S.sendBatch(id, "admin@example.org");
  assert.equal((r as any).data.stopped, "CANCELLED"); assert.equal(sent.length, n);
});
