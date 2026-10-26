import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { variedApplications } from "./helpers/varied";
import { can } from "../lib/auth/permissions";

// Own process: throw-away local store, fake Resend.
process.chdir(mkdtempSync(path.join(tmpdir(), "features-test-")));
Object.assign(process.env, { DATA_BACKEND: "local", SESSION_SECRET: "x".repeat(40), LEVEL2_OPEN_TO_ALL: "true", RESEND_API_KEY: "re_test", EMAIL_FROM: "Contest <apply@example.org>" });
delete process.env.NEXT_PUBLIC_DEMO_MODE; delete process.env.LEVEL2_CLOSE_DATE; delete process.env.GMAIL_USER; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL;
const sent: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
  if (String(url).startsWith("https://api.resend.com/")) { sent.push(JSON.parse(init!.body!).to[0]); return new Response(JSON.stringify({ id: "em" }), { status: 200 }); }
  return realFetch(url as string, init as RequestInit);
}) as typeof fetch;

const apps = variedApplications(10, 5);
apps.forEach((a) => { a.submissionStatus = "SHORTLISTED"; });
mkdirSync(".data", { recursive: true });
writeFileSync(".data/dev-store.json", JSON.stringify({ applications: apps, drafts: [], events: [], staff: [], mentors: [], reviews: [] }));

test("only administrators can change settings", () => {
  assert.equal(can("ADMIN", "config:manage"), true);
  for (const r of ["COORDINATOR", "JUDGE", "REVIEWER"] as const) assert.equal(can(r, "config:manage"), false);
});

test("switches: defaults, newest change wins, history kept, junk ignored", async () => {
  const F = await import("../lib/features");
  const { getRepository } = await import("../lib/repository");
  const first = await F.loadFeatures(true);
  assert.equal(first.source, "sheet"); assert.equal(first.state.level2Form, true); assert.equal(first.state.mentorForm, true);

  await F.setFeature("mentorForm", false, "boss@example.org");
  await F.setFeature("mentorForm", true, "boss@example.org");
  const s = await F.setFeature("mentorForm", false, "admin@example.org");
  assert.equal(s.state.mentorForm, false); assert.equal(s.changes.mentorForm?.updatedBy, "admin@example.org");
  assert.equal(await F.featureOn("mentorForm"), false, "the cache was refreshed at once");
  const rows = await getRepository().getConfiguration();
  assert.deepEqual(rows.map((r) => [r.key, r.value]), [["feature.mentorForm", "off"], ["feature.mentorForm", "on"], ["feature.mentorForm", "off"]], "every change is a new row");
  const events = (await getRepository().getEvents(50)).filter((e) => e.action === "FEATURE_SWITCHED");
  assert.equal(events.length, 3); assert.match(events[0].detail, /mentorForm OFF/);

  await getRepository().appendConfiguration({ key: "feature.mentorForm", value: "maybe", updatedAt: "x", updatedBy: "x" });
  await getRepository().appendConfiguration({ key: "feature.unknownThing", value: "off", updatedAt: "x", updatedBy: "x" });
  await getRepository().appendConfiguration({ key: "legacy_key", value: "off", updatedAt: "x", updatedBy: "x" });
  const after = await F.loadFeatures(true);
  assert.equal(after.state.mentorForm, false, "an unreadable value does not change the switch");
  assert.ok(!("unknownThing" in after.state)); await F.setFeature("mentorForm", true, "admin@example.org");
});

test("a sheet that cannot be read keeps the last known switches", async () => {
  const F = await import("../lib/features");
  const repo = (await import("../lib/repository")).getRepository();
  await F.setFeature("aiDataDesk", false, "admin@example.org");
  const real = repo.getConfiguration; (repo as any).getConfiguration = async () => { throw new Error("Sheets timed out"); };
  try {
    const s = await F.loadFeatures(true);
    assert.equal(s.source, "last-known"); assert.equal(s.state.aiDataDesk, false); assert.match(s.problem!, /timed out/);
  } finally { (repo as any).getConfiguration = real; await F.setFeature("aiDataDesk", true, "admin@example.org"); }
});

test("Level 2 form switch: nobody can start or submit while it is off", async () => {
  const F = await import("../lib/features");
  const S = await import("../lib/services/level2Service");
  const a = apps[0];
  const ok = await S.startLevel2({ code: a.applicationId, email: a.applicant.email }); assert.ok(ok.ok);
  await F.setFeature("level2Form", false, "admin@example.org");
  const r = await S.startLevel2({ code: a.applicationId, email: a.applicant.email });
  assert.equal(r.status, 503); assert.equal((r as any).body.code, "FEATURE_OFF");
  const sub = await S.submitLevel2((ok as any).data.token, {}); assert.equal(sub.status, 503, "a pass issued earlier cannot submit either");
  await F.setFeature("level2Form", true, "admin@example.org");
});

test("Messages switch: nothing is sent while off; Continue works once it is back on", async () => {
  const F = await import("../lib/features");
  const M = await import("../lib/services/emailCampaignService");
  const msg = { subject: "Hello {first_name}", heading: "", body: "Dear {first_name},\n\nA short note.\n\nThe team", audience: { kind: "pasted", text: "a@partner.org\nb@partner.org" } };
  const c = await M.createCampaign(msg, "admin@example.org"); assert.ok(c.ok);
  const id = (c as any).data.campaign.campaignId;
  await F.setFeature("messages", false, "admin@example.org");
  sent.length = 0;
  const r = await M.sendBatch(id, "admin@example.org");
  assert.equal((r as any).data.stopped, "FEATURE_OFF"); assert.equal(sent.length, 0);
  assert.equal((await M.createCampaign(msg, "admin@example.org")).status, 503);
  assert.equal((await M.sendTest(msg, "admin@example.org")).status, 503);
  await F.setFeature("messages", true, "admin@example.org");
  const r2 = await M.sendBatch(id, "admin@example.org");
  assert.equal((r2 as any).data.done, true); assert.equal(sent.length, 2);
});
