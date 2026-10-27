import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Own process: local store, fake Resend, no Redis.
process.chdir(mkdtempSync(path.join(tmpdir(), "staff-invite-test-")));
Object.assign(process.env, { DATA_BACKEND: "local", SESSION_SECRET: "s".repeat(40), RESEND_API_KEY: "re_test", EMAIL_FROM: "Contest <apply@example.org>" });
delete process.env.NEXT_PUBLIC_DEMO_MODE; delete process.env.GMAIL_USER; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL; delete process.env.ADMIN_USERS_JSON;
const sent: Array<{ to: string; subject: string; html: string; text: string }> = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
  if (String(url).startsWith("https://api.resend.com/")) { const b = JSON.parse(init!.body!); sent.push({ ...b, to: b.to[0] }); return new Response(JSON.stringify({ id: "em" }), { status: 200 }); }
  return realFetch(url as string, init as RequestInit);
}) as typeof fetch;

const mentor = (i: number, roles: string[], email = `p${i}@example.org`) => ({ mentorId: `MNTR-2026-AAAAA${i}`, status: "NEW", submittedAt: `2026-10-1${i}T10:00:00Z`, updatedAt: "", fullName: `Person ${i}`,
  firstName: `Person`, lastName: `${i}`, email, phone: "", state: "Kaduna", location: "", profession: "Agronomist", organization: "", industry: "", yearsExperience: 5, mentorshipExperience: "",
  expertise: [], availability: "", availabilityNotes: "", linkedin: "", portfolio: "", motivation: "", documents: [], consent: true, source: "web", roles });
const boss = { userId: "U0", name: "Boss", email: "boss@example.org", role: "ADMIN", active: true, note: "", passwordHash: "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.4zFq3qIuF6Jd5o7oB7R0nY1Zb6F2", updatedAt: "", source: "sheet" };
mkdirSync(".data", { recursive: true });
writeFileSync(".data/dev-store.json", JSON.stringify({ applications: [], drafts: [], events: [], staff: [boss], reviews: [],
  mentors: [mentor(2, ["JUDGE"]), mentor(3, ["REVIEWER"]), mentor(4, ["MENTOR"]), mentor(5, ["REVIEWER"], "Boss@Example.org"), mentor(6, ["REVIEWER"], "not-an-email")] }));
const ORIGIN = "https://contest.example.org";

test("panel applicants are listed with a suggested role and whether they already have an account", async () => {
  const S = await import("../lib/services/staffService");
  const c = await S.panelCandidates();
  const by = Object.fromEntries(c.map((x) => [x.mentorId, x]));
  assert.equal(by["MNTR-2026-AAAAA2"].suggestedRole, "JUDGE");
  assert.equal(by["MNTR-2026-AAAAA4"].suggestedRole, "REVIEWER", "mentors get a Reviewer account by default");
  assert.equal(by["MNTR-2026-AAAAA5"].account?.role, "ADMIN", "matched to an existing account, ignoring case");
  assert.equal(by["MNTR-2026-AAAAA3"].account, null);
});

test("create accounts from panel applications: invite emailed with a working one-time link", async () => {
  const S = await import("../lib/services/staffService");
  const U = await import("../lib/auth/users");
  const { getRepository } = await import("../lib/repository");
  const r = await S.invitePanel({ people: [{ mentorId: "MNTR-2026-AAAAA2", role: "JUDGE" }, { mentorId: "MNTR-2026-AAAAA3", role: "REVIEWER" }, { mentorId: "MNTR-2026-AAAAA5", role: "REVIEWER" }, { mentorId: "MNTR-2026-AAAAA6", role: "REVIEWER" }] }, "boss@example.org", ORIGIN);
  assert.ok(r.ok); const res = (r as any).data.results;
  assert.deepEqual(res.map((x: any) => [x.mentorId.slice(-2), x.outcome, x.emailed]), [["A2", "created", true], ["A3", "created", true], ["A5", "already", false], ["A6", "failed", false]]);
  const staff = (await U.listStaff()).filter((s) => s.email !== "boss@example.org");
  assert.deepEqual(staff.map((s) => [s.email, s.role, s.status]).sort(), [["p2@example.org", "JUDGE", "invited"], ["p3@example.org", "REVIEWER", "invited"]]);
  assert.equal((await getRepository().getMentorById("MNTR-2026-AAAAA2"))?.status, "ACCEPTED", "panel application marked accepted");

  assert.equal(sent.length, 2);
  const mail = sent.find((m) => m.to === "p2@example.org")!;
  assert.match(mail.subject, /judge account/i);
  const link = /https:\/\/contest\.example\.org\/reset-password\?token=(\S+)/.exec(mail.text)![1];
  assert.ok(mail.html.includes(`href="${ORIGIN}/reset-password?token=${link}"`), "the HTML version has a clickable button");

  // The person opens the link, sets a password, and can sign in. The same link then stops working.
  assert.deepEqual(await U.peekPasswordLink(link), { email: "p2@example.org", purpose: "invite" });
  assert.equal((await U.completePasswordLink(link, "short")).ok, false, "weak password: link still valid");
  assert.ok((await U.completePasswordLink(link, "green maize fields at dawn")).ok);
  assert.ok(await U.authenticate("p2@example.org", "green maize fields at dawn"), "can sign in");
  assert.equal(await U.peekPasswordLink(link), null, "used once, then dead");
  assert.equal((await U.completePasswordLink(link, "another long password here")).ok, false);

  const again = await S.invitePanel({ people: [{ mentorId: "MNTR-2026-AAAAA2", role: "JUDGE" }] }, "boss@example.org", ORIGIN);
  assert.equal((again as any).data.results[0].outcome, "already", "never two accounts for one person");
});

test("resend: a fresh reset link is emailed for an existing account; without email the link is still returned", async () => {
  const S = await import("../lib/services/staffService");
  sent.length = 0;
  const r = await S.sendPasswordLink("P2@example.org", "boss@example.org", ORIGIN, true);
  assert.ok(r.ok); assert.equal((r as any).data.purpose, "reset"); assert.equal((r as any).data.emailed, true); assert.equal(sent[0].to, "p2@example.org");
  delete process.env.RESEND_API_KEY;
  try {
    const off = await S.sendPasswordLink("p3@example.org", "boss@example.org", ORIGIN, true);
    assert.equal((off as any).data.emailed, false); assert.match((off as any).data.emailProblem, /copy the link/i); assert.match((off as any).data.link, /reset-password\?token=/);
  } finally { process.env.RESEND_API_KEY = "re_test"; }
  assert.equal((await S.sendPasswordLink("nobody@example.org", "boss@example.org", ORIGIN, true)).status, 400);
});
