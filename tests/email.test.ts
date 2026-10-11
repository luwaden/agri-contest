import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// This file runs in its own process: use a throw-away local store and a fake Resend API (no real email is sent).
process.chdir(mkdtempSync(path.join(tmpdir(), "email-test-")));
Object.assign(process.env, {
  DATA_BACKEND: "local", APPLICATION_OPEN_DATE: "2020-01-01T00:00:00+01:00", APPLICATION_CLOSE_DATE: "2099-01-01T00:00:00+01:00",
  RESEND_API_KEY: "re_test", EMAIL_FROM: "Youth Agri-Innovation Contest <apply@example.org>",
  NEXT_PUBLIC_SITE_URL: "https://agri-contest.example",
});
delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL;

type Sent = { to: string[]; subject: string; html: string; text: string; reply_to: string; key: string | null };
const sent: Sent[] = []; let failNext = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  if (String(url).startsWith("https://api.resend.com/")) {
    if (failNext > 0) { failNext--; return new Response(JSON.stringify({ message: "You have reached your daily email sending quota." }), { status: 429 }); }
    sent.push({ ...JSON.parse(init.body), key: init.headers["Idempotency-Key"] ?? null });
    return new Response(JSON.stringify({ id: `em_${sent.length}` }), { status: 200 });
  }
  return realFetch(url, init);
}) as typeof fetch;
const settle = async (n: number) => { for (let i = 0; i < 100 && sent.length < n; i++) await new Promise((r) => setTimeout(r, 20)); };

const load = async () => ({
  ...(await import("../lib/services/applicationService")), ...(await import("../lib/services/mentorService")),
  ...(await import("../lib/repository")), ...(await import("../lib/email/templates")), ...(await import("../lib/demo-values")), ...(await import("../config/programme")),
});

test("contact address is youthagriinnovate@gmail.com and replies go there", async () => {
  const { PROGRAMME } = await load();
  assert.equal(PROGRAMME.contactEmail, "youthagriinnovate@gmail.com");
});

test("applicant gets one confirmation with the reference number, sent after the application is saved", async () => {
  const { submitApplication, getRepository, SAMPLE_VALUES } = await load();
  const r = await submitApplication({ values: { ...SAMPLE_VALUES, declaration: true, email: "amina.test@example.com" } });
  assert.equal(r.ok, true, JSON.stringify(!r.ok && r.body));
  if (!r.ok) return;
  await settle(1);
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.deepEqual(m.to, ["amina.test@example.com"]);
  assert.equal(m.reply_to, "youthagriinnovate@gmail.com");
  assert.equal(m.subject, `Application received: ${r.data.applicationId}`);
  assert.ok(m.html.includes(r.data.applicationId) && m.text.includes(r.data.applicationId));
  assert.equal(m.key, `app-confirm-${r.data.applicationId}`, "idempotency key stops duplicates if a send is retried");
  assert.ok(await getRepository().getApplicationById(r.data.applicationId), "the application itself is saved");
});

test("if the email fails, the application still succeeds and EMAIL_FAILED is logged", async () => {
  const { submitApplication, getRepository, SAMPLE_VALUES } = await load();
  failNext = 1; const before = sent.length;
  const r = await submitApplication({ values: { ...SAMPLE_VALUES, declaration: true, email: "bola.test@example.com" } });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  for (let i = 0; i < 100; i++) { const ev = (await getRepository().getEvents(100)).filter((e) => e.applicationId === r.data.applicationId); if (ev.some((e) => e.action === "EMAIL_FAILED")) break; await new Promise((x) => setTimeout(x, 20)); }
  assert.equal(sent.length, before, "nothing was delivered");
  const failed = (await getRepository().getEvents(100)).find((e) => e.applicationId === r.data.applicationId && e.action === "EMAIL_FAILED");
  assert.ok(failed, "failure recorded in Application Events");
  assert.match(failed!.detail, /DAILY_LIMIT/);
});

test("panel (mentor/judge/reviewer) applications send NO email, to anyone", async () => {
  const { submitMentor } = await load();
  failNext = 0; const before = sent.length;
  const r = await submitMentor({ firstName: "Ada", lastName: "Obi", email: "ada.panel@example.com", phone: "+2348031234567", state: "Lagos", profession: "Agri-finance manager, AgriBank", yearsExperience: "12", role: "JUDGE", coi: true, expertise: ["AGRI_FINANCE"], availability: "2_5", linkedin: "linkedin.com/in/ada-obi", consent: true });
  assert.equal(r.ok, true, JSON.stringify(!r.ok && r.body));
  await new Promise((x) => setTimeout(x, 300));
  assert.equal(sent.length, before);
});

test("applicant email links Plus Incubation Hub's website", async () => {
  const { applicantConfirmation } = await load();
  const m = applicantConfirmation({ applicationId: "AGRA-2026-AAAAAA", submittedAt: null, firstName: "Amina", email: "x@example.com" });
  assert.ok(m.html.includes('href="https://www.plusincubationhub.com"')); assert.match(m.text, /www\.plusincubationhub\.com/);
  assert.ok(!m.html.includes("plusincubationhub@gmail.com") && !m.text.includes("plusincubationhub@gmail.com"));
});

test("names typed by applicants cannot inject HTML into the email", async () => {
  const { applicantConfirmation } = await load();
  const m = applicantConfirmation({ applicationId: "AGRA-2026-AAAAAA", submittedAt: null, firstName: `<img src=x onerror=alert(1)>`, email: "x@example.com", businessName: `"><script>alert(1)</script>` });
  assert.ok(!m.html.includes("<script>") && !m.html.includes("<img src=x"));
  assert.ok(m.html.includes("&lt;script&gt;"));
});

test("the email repeats none of the applicant's answers beyond first name and venture name", async () => {
  const { applicantConfirmation } = await load();
  const m = applicantConfirmation({ applicationId: "AGRA-2026-AAAAAA", submittedAt: null, firstName: "Amina", email: "x@example.com" });
  for (const secret of ["date of birth", "phone number", "+234", "NIN", "BVN", "home address"]) assert.ok(!m.text.toLowerCase().includes(secret.toLowerCase()), secret);
});
