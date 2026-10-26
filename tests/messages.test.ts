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
const staff = [["Judge One", "judge1@example.org", "JUDGE", true], ["Rev One", "rev1@example.org", "REVIEWER", true], ["Old Judge", "old@example.org", "JUDGE", false], ["Boss", "boss@example.org", "ADMIN", true]]
  .map(([name, email, role, active], i) => ({ userId: `U${i}`, name, email, role, active, note: "", passwordHash: "", updatedAt: "2026-10-19T00:00:00Z", source: "sheet" }));
const mentors = [["Ada", "Obi", "ada@mentor.org", "ACCEPTED"], ["Bayo", "Ade", "bayo@mentor.org", "NEW"]].map(([firstName, lastName, email, status], i) => ({ mentorId: `MNTR-2026-AAAAA${i + 2}`, status, firstName, lastName, fullName: `${firstName} ${lastName}`, email, state: "Lagos" }));
writeFileSync(".data/dev-store.json", JSON.stringify({ applications: apps, drafts: [], events: [], staff, mentors, reviews: [] }));

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
  assert.equal(d.count, 47, "50 shortlisted − 1 draft − 1 duplicate email − 1 invalid address");
  assert.ok(d.warnings.some((w: string) => /1 left out because their email address is not valid/.test(w)));
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
  assert.equal(to.length, 47, "everyone with a valid address");
  assert.ok(to.includes(apps[20].applicant.email.toLowerCase()), "a temporary failure is retried");
  assert.ok(!to.includes("not-an-address"));
  assert.equal(new Set(sent.map((s) => s.key)).size, sent.length, "unique idempotency key per email");
  const before = sent.length; await S.sendBatch(id, "admin@example.org"); assert.equal(sent.length, before, "a finished message sends nothing more");
  const list = await S.listCampaigns(); const v = list.campaigns.find((x) => x.campaignId === id)!;
  assert.deepEqual([v.total, v.sent, v.remaining], [47, 47, 0]);
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

test("any email address can receive a message: pasted contacts, staff and panel applicants, mixed with applicants", async () => {
  const S = await import("../lib/services/emailCampaignService");
  const body = { subject: "Invitation, {first_name}", heading: "", body: "Dear {first_name},\n\nYou are invited to the demo day.\n\nRef: {application_id}" };
  const pasted = `Amina Bello <amina@partner.org>\npartner2@agency.gov.ng, Musa Ibrahim\nsolo@gmail.com\n${apps[10].applicationId}\n${apps[11].applicant.email}\nAmina again <AMINA@partner.org>\nnot an address`;
  const p = await S.preview({ ...body, audience: { kind: "pasted", text: pasted } });
  assert.ok(p.ok); const d = (p as any).data;
  assert.equal(d.count, 5, "3 outside contacts + 2 applicants; the repeated address counts once");
  assert.equal(d.others, 3); assert.deepEqual(d.notFound, ["not an address"]);
  assert.match(d.warnings[0], /3 recipient\(s\) are not applicants/);
  assert.equal(d.email.subject, "Invitation, Amina");
  assert.ok(!d.email.html.includes("Reference number") && d.email.html.includes("Sent by the programme team"), "outside contacts: no reference box, neutral footer");
  const sample = d.sample.map((x: any) => x.email);
  assert.ok(sample.includes(apps[11].applicant.email), "an applicant's address is treated as that applicant");

  const st = await S.preview({ ...body, audience: { kind: "staff", role: "PANEL" } });
  assert.deepEqual((st as any).data.sample.map((x: any) => x.email).sort(), ["judge1@example.org", "rev1@example.org"], "active judges and reviewers only");
  const all = await S.preview({ ...body, audience: { kind: "staff", role: "ALL" } });
  assert.equal((all as any).data.count, 3);
  const me = await S.preview({ ...body, audience: { kind: "mentors", status: "ACCEPTED" } });
  assert.deepEqual((me as any).data.sample.map((x: any) => [x.name, x.email]), [["Ada Obi", "ada@mentor.org"]]);

  // Send to the pasted list: everyone once, outside contacts logged as EXTERNAL, nothing repeated.
  sent.length = 0;
  const c = await S.createCampaign({ ...body, audience: { kind: "pasted", text: pasted } }, "admin@example.org");
  const id = (c as any).data.campaign.campaignId as string;
  let r = await S.sendBatch(id, "admin@example.org"); assert.equal((r as any).data.done, true);
  r = await S.sendBatch(id, "admin@example.org");
  assert.equal(sent.length, 5); assert.equal(new Set(sent.map((x) => x.to[0].toLowerCase())).size, 5);
  const toAmina = sent.find((x) => x.to[0] === "amina@partner.org")!;
  assert.match(toAmina.subject, /Invitation, Amina/); assert.ok(!toAmina.text.includes("Reference number"));
  const toApplicant = sent.find((x) => x.to[0] === apps[10].applicant.email.trim())!;
  assert.ok(toApplicant.text.includes(`Reference number: ${apps[10].applicationId}`));
  const v = (await S.listCampaigns()).campaigns.find((x) => x.campaignId === id)!;
  assert.deepEqual([v.total, v.sent, v.remaining], [5, 5, 0]);
});

test("attachments: checked on upload, shown in the preview, sent with every email, and never silently dropped", async () => {
  const S = await import("../lib/services/emailCampaignService");
  const A = await import("../lib/email/attachments");
  const pdf = new TextEncoder().encode("%PDF-1.4\n% programme timetable\n%%EOF");
  const bad = await A.saveAttachment(new TextEncoder().encode("MZ definitely not a pdf"), "timetable.pdf");
  assert.equal(bad.ok, false, "a renamed file is refused");
  assert.equal((await A.saveAttachment(pdf, "run.exe")).ok, false, "unknown type refused");
  const up = await A.saveAttachment(pdf, "Demo Day / Timetable:final.pdf");
  assert.ok(up.ok); const att = (up as any).data;
  assert.match(att.id, A.ATTACHMENT_ID); assert.equal(att.name, "Demo Day Timetable final.pdf", "safe file name");

  const withFile = { subject: "Demo day, {first_name}", heading: "Demo day", body: "Dear {first_name},\n\nThe timetable is attached.\n\nThe team", attachments: [att.id] };
  const audience = { kind: "pasted", text: "Ada <ada@partner.org>\nbayo@partner.org\nchi@partner.org" };
  const p = await S.preview({ ...withFile, audience });
  assert.ok(p.ok); assert.deepEqual((p as any).data.attachments.map((x: any) => x.name), ["Demo Day Timetable final.pdf"]);
  assert.equal((await S.preview({ ...withFile, attachments: ["ATT-" + "0".repeat(24)], audience })).status, 422, "a missing file is refused before sending");

  sent.length = 0;
  const t = await S.sendTest({ ...withFile, audience }, "boss@example.org"); assert.ok(t.ok);
  assert.equal((sent[0] as any).attachments?.[0]?.filename, "Demo Day Timetable final.pdf", "the test carries the file too");

  sent.length = 0;
  const c = await S.createCampaign({ ...withFile, audience }, "admin@example.org"); assert.ok(c.ok);
  const camp = (c as any).data.campaign; assert.deepEqual(camp.attachments, ["Demo Day Timetable final.pdf"]);
  const r = await S.sendBatch(camp.campaignId, "admin@example.org"); assert.equal((r as any).data.done, true);
  assert.equal(sent.length, 3);
  for (const m of sent as any[]) {
    assert.equal(m.attachments.length, 1);
    assert.deepEqual(new Uint8Array(Buffer.from(m.attachments[0].content, "base64")), pdf, "file arrives intact");
    assert.match(m.subject, /^Demo day, /); assert.ok(!m.html.includes("[[attachments"), "the stored file list never leaks into the email");
  }
  const listed = (await S.listCampaigns()).campaigns.find((x) => x.campaignId === camp.campaignId)!;
  assert.deepEqual(listed.attachments, ["Demo Day Timetable final.pdf"]);

  // The file disappears before a later batch: stop, send nothing, log nothing.
  const c2 = await S.createCampaign({ ...withFile, audience: { kind: "pasted", text: "dee@partner.org" } }, "admin@example.org");
  const { rmSync } = await import("node:fs");
  rmSync(path.join(".data", "files", "email-attachments", att.id), { recursive: true });
  sent.length = 0;
  const r2 = await S.sendBatch((c2 as any).data.campaign.campaignId, "admin@example.org");
  assert.equal((r2 as any).data.stopped, "ATTACHMENT_MISSING"); assert.equal(sent.length, 0);

  // Old messages without files still read correctly.
  assert.deepEqual(S.splitBody("#Heading\nHello"), { heading: "Heading", body: "Hello", files: [] });
  assert.deepEqual(S.splitBody("[[not ours]]\nHello"), { heading: "", body: "[[not ours]]\nHello", files: [] });
});
