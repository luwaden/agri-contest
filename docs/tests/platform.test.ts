import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { GEOPOLITICAL_ZONES, zoneOf } from "../config/admin";
import { HEADER_PARTNERS, FOOTER_PARTNERS, NIGERIAN_STATES } from "../config/programme";
import { validateMentor } from "../lib/validation/mentor";
import { checkFile, sniff } from "../lib/cloudinary/validate";
import { parseCloudinaryUrl, sign } from "../lib/cloudinary/client";
import { uploadFolder } from "../lib/cloudinary/folders";
import { buildAIContext, buildPrompt, scrub } from "../lib/ai/context";
import { csvCell } from "../lib/csv";
import { validateAll } from "../lib/validation/application";
import { toApplication } from "../lib/mapper";
import { computeAnalytics } from "../lib/analytics/compute";
import { filterApplications } from "../lib/analytics/filters";
import { sample } from "./fixtures";

const app = (o: Record<string, unknown> = {}, id = "AGRA-2026-AAAAAA") =>
  toApplication(validateAll({ ...sample, declaration: true, ...o }).data, { applicationId: id, status: "SUBMITTED", now: new Date("2026-10-05T10:00:00Z") });

// ───────── zones (admin analytics) ─────────
test("every state belongs to exactly one geopolitical zone", () => {
  for (const s of NIGERIAN_STATES) assert.notEqual(zoneOf(s), "Unknown", s);
  const all = Object.values(GEOPOLITICAL_ZONES).flat(); assert.equal(all.length, new Set(all).size); assert.equal(all.length, NIGERIAN_STATES.length);
  assert.equal(zoneOf("Kaduna"), "North West"); assert.equal(zoneOf("Niger"), "North Central"); assert.equal(zoneOf("Nasarawa"), "North Central");
});
test("analytics + filters by zone, and focal states stay segmentable", () => {
  const list = [app({ state: "Kaduna" }, "AGRA-2026-AAAAA2"), app({ state: "Lagos" }, "AGRA-2026-AAAAA3"), app({ state: "Niger" }, "AGRA-2026-AAAAA4")];
  assert.equal(filterApplications(list, { zone: "North Central" }).length, 1);
  const a = computeAnalytics(list);
  assert.equal(a.zones.find((z) => z.zone === "South West")!.count, 1);
  assert.equal(a.focal.kadunaCount, 1); assert.equal(a.focal.nigerCount, 1); assert.equal(a.focal.nasarawaCount, 0); assert.equal(a.focal.focalStateCount, 2);
});

// ───────── mentors ─────────
const mentor = { firstName: "Ada", lastName: "Obi", email: "Ada@Example.com", phone: "+2348031234567", state: "Lagos", profession: "Agri-finance manager, AgriBank", yearsExperience: "12", role: "MENTOR", expertise: ["AGRI_FINANCE"], availability: "2_5", motivation: "", linkedin: "https://www.linkedin.com/in/ada-obi", consent: true };
test("panel form: valid input passes and is normalised", () => { const r = validateMentor(mentor); assert.equal(r.ok, true); if (r.ok) assert.equal(r.data.email, "ada@example.com"); });
test("panel form: friendly errors", () => {
  const r = validateMentor({ ...mentor, firstName: "", lastName: "", expertise: [], role: "", consent: false, linkedin: "javascript:alert(1)" });
  assert.equal(r.ok, false); if (!r.ok) {
    assert.equal(r.errors.firstName, "Please enter your first name."); assert.equal(r.errors.lastName, "Please enter your surname.");
    assert.match(r.errors.expertise, /at least one area/); assert.match(r.errors.role, /what you would like to serve as/); assert.ok(r.errors.consent); assert.match(r.errors.linkedin, /LinkedIn/);
  }
});
test("panel form: first name and surname are separate, letters only, and the full name is built from them", () => {
  assert.equal(validateMentor({ ...mentor, firstName: "Ada Obi" , lastName: "" }).ok, false);
  assert.equal(validateMentor({ ...mentor, firstName: "=HYPERLINK(1)" }).ok, false);
  const r = validateMentor({ ...mentor, firstName: "  Chukwuemeka ", lastName: "Ọkafor-Adé" }); assert.equal(r.ok, true); if (r.ok) assert.deepEqual([r.data.firstName, r.data.lastName], ["Chukwuemeka", "Ọkafor-Adé"]);
});
test("panel form: LinkedIn is required and must be a linkedin.com link (https:// added if missing)", () => {
  for (const bad of ["", undefined, "https://example.com/ada", "https://linkedin.com.evil.io/in/x", "https://www.linkedin.com/", "not a link"]) assert.equal(validateMentor({ ...mentor, linkedin: bad }).ok, false, String(bad));
  const r = validateMentor({ ...mentor, linkedin: "linkedin.com/in/ada-obi" }); assert.equal(r.ok, true); if (r.ok) assert.equal(r.data.linkedin, "https://linkedin.com/in/ada-obi");
  const h = validateMentor({ ...mentor, linkedin: "http://ng.linkedin.com/in/ada" }); assert.equal(h.ok, true); if (h.ok) assert.equal(h.data.linkedin, "https://ng.linkedin.com/in/ada");
});
test("panel form: exactly ONE role; a list of roles is refused", () => {
  assert.equal(validateMentor({ ...mentor, role: ["MENTOR", "JUDGE"] }).ok, false);
  assert.equal(validateMentor({ ...mentor, role: "CHAIR" }).ok, false);
});
test("panel form: judges and reviewers must accept the conflict-of-interest declaration; mentors need not", () => {
  assert.equal(validateMentor({ ...mentor, role: "JUDGE" }).ok, false);
  assert.equal(validateMentor({ ...mentor, role: "REVIEWER", coi: false }).ok, false);
  assert.equal(validateMentor({ ...mentor, role: "JUDGE", coi: true }).ok, true);
  assert.equal(validateMentor({ ...mentor, role: "MENTOR" }).ok, true);
});
test("panel form: every question is required except 'anything else'", () => {
  const required = ["firstName", "lastName", "email", "phone", "state", "profession", "yearsExperience", "role", "expertise", "availability", "linkedin"];
  for (const k of required) assert.equal(validateMentor({ ...mentor, [k]: k === "expertise" ? [] : "" }).ok, false, k);
  assert.equal(validateMentor({ ...mentor, motivation: undefined }).ok, true);
});

// ───────── uploads / cloudinary ─────────
const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(40).fill(0)]);
test("file checks use real content, not the file name", () => {
  assert.equal(checkFile(bytes(0x25, 0x50, 0x44, 0x46), "deck.pdf").ok, true);
  assert.equal(checkFile(bytes(0x4d, 0x5a, 0x90), "virus.pdf").ok, false);           // Windows executable renamed .pdf
  assert.equal(checkFile(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "p.pdf").ok, false); // PNG named .pdf
  assert.equal(checkFile(bytes(0x50, 0x4b, 0x03, 0x04), "plan.docx").ok, true);
  assert.equal(checkFile(bytes(0x50, 0x4b, 0x03, 0x04), "tool.exe").ok, false);
  assert.equal(checkFile(bytes(0xff, 0xd8, 0xff, 0xe0), "photo.jpeg").ok, true);
  assert.equal(checkFile(new Uint8Array(0), "a.pdf").ok, false);
  const big = new Uint8Array(9 * 1024 * 1024); big.set([0x25, 0x50, 0x44, 0x46]); assert.equal(checkFile(big, "big.pdf").ok, false);
  assert.equal(sniff(bytes(1, 2, 3)), null);
});
test("cloudinary signature matches the documented algorithm", () => {
  const expected = createHash("sha1").update("public_id=sample&timestamp=1315060510abcd").digest("hex");
  assert.equal(sign({ timestamp: 1315060510, public_id: "sample", file: undefined }, "abcd"), expected);
});
test("cloudinary URLs parse back to their parts", () => {
  const img = parseCloudinaryUrl("https://res.cloudinary.com/democloud/image/authenticated/s--abc--/v1730000000/programme/applicants/stage-3/sess123456789/pitch-deck-abc.pdf")!;
  assert.deepEqual([img.cloudName, img.resourceType, img.type, img.version, img.publicId, img.format], ["democloud", "image", "authenticated", "1730000000", "programme/applicants/stage-3/sess123456789/pitch-deck-abc", "pdf"]);
  const raw = parseCloudinaryUrl("https://res.cloudinary.com/democloud/raw/upload/v1/programme/mentors/MNTR-2026-ABC234/cv-1.docx")!;
  assert.equal(raw.publicId, "programme/mentors/MNTR-2026-ABC234/cv-1.docx"); assert.equal(raw.format, undefined);
  assert.equal(parseCloudinaryUrl("https://evil.example.com/image/upload/x.png"), null);
});
test("cloudinary folders follow the documented structure", () => {
  assert.equal(uploadFolder("applicant", "abcdefghij12345", 2), "programme/applicants/stage-2/abcdefghij12345");
  assert.equal(uploadFolder("mentor", "MNTR-2026-ABC234"), "programme/mentors/MNTR-2026-ABC234");
  assert.throws(() => uploadFolder("applicant", "../../etc", 1)); assert.throws(() => uploadFolder("applicant", "abcdefghij12345", 9));
});

// ───────── AI: data minimisation ─────────
test("AI context never contains personal data", () => {
  const apps = [app({ state: "Kaduna", email: "secret.person@example.com", phone: "08031234567", firstName: "Zainab", lastName: "Mohammed" }, "AGRA-2026-AAAAA2")];
  const json = buildAIContext("How many applicants applied from Kaduna?", apps, {}).json;
  for (const pii of ["secret.person", "Zainab", "Mohammed", "08031234567", "+2348031234567", "AGRA-2026-AAAAA2", "Samaru", "Green Harvest", "12 Farm Road"]) assert.ok(!json.includes(pii), `leaked: ${pii}`);
  assert.ok(json.includes('"kaduna":1'));
});
test("AI text excerpts are off by default and scrubbed when enabled", () => {
  const apps = [app({ problem: "Farmers call me on 08031234567 or write to help@farm.org see https://x.co about the problem of post-harvest losses" })];
  assert.ok(!buildAIContext("what are the common challenges?", apps, {}).json.includes("anonymisedTextExcerpts"));
  process.env.AI_ALLOW_TEXT_EXCERPTS = "true";
  const ctx = buildAIContext("what are the common challenges?", apps, {});
  delete process.env.AI_ALLOW_TEXT_EXCERPTS;
  assert.equal(ctx.shared.excerpts, 1); assert.ok(!ctx.json.includes("help@farm.org") && !ctx.json.includes("08031234567") && !ctx.json.includes("https://x.co"));
  assert.equal(scrub("a@b.co"), "[email]");
});
test("AI prompt marks applicant text as untrusted and bounds the question", () => {
  const p = buildPrompt("x".repeat(900), buildAIContext("q", [], {}));
  assert.match(p.system, /untrusted/); assert.ok(p.messages[0].content.length < 4000);
});

// ───────── export ─────────
test("CSV cells neutralise spreadsheet formulas", () => {
  assert.equal(csvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\""); assert.equal(csvCell("+1"), "'+1"); assert.equal(csvCell("a,b"), "\"a,b\""); assert.equal(csvCell(null), "");
});

// ───────── brand + public-wording guarantees (source scans) ─────────
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? (["node_modules", ".next", ".data"].includes(f) ? [] : walk(p)) : [p]; });
const files = [...walk("app"), ...walk("components"), ...walk("config"), ...walk("lib"), ...walk("docs"), ...walk("scripts"), "README.md", "tailwind.config.ts"].filter((f) => /\.(tsx?|md|mjs|json|svg)$/.test(f));
test("old System-Strengthening / SBAF branding is gone from the whole codebase", () => {
  const bad = /systems? strengthening|\bSBAF\b|BDS Provision|res\.cloudinary\.com\/dadfwcmhd/i;
  for (const f of files) assert.ok(!bad.test(readFileSync(f, "utf8")), `old branding in ${f}`);
  assert.ok(!statSync("public").isDirectory() || !walk("public").some((f) => /brand\/fallback|sbaf/i.test(f)));
});
test("public pages never mention a selection quota or focal states", () => {
  const publicFiles = files.filter((f) => /^(app[\\/](page|mentors|privacy|terms|apply|layout|sitemap|robots)|components[\\/](landing|mentors|application|ui|brand)|config[\\/](programme|mentors|media))/.test(f.replace(/\\/g, "/").replace("app/", "app/")));
  assert.ok(publicFiles.length > 15);
  for (const f of publicFiles) { const t = readFileSync(f, "utf8"); assert.ok(!/\b(60|40)\s?%/.test(t), `quota wording in ${f}`); assert.ok(!/focal/i.test(t), `focal wording in ${f}`); assert.ok(!/FOCAL_STATES|TARGETS|config\/admin/.test(t), `admin config imported by public file ${f}`); }
});
test("header partner logos are in the required order", () => assert.deepEqual(HEADER_PARTNERS.map((p) => p.id), ["agra", "smedan", "kbs", "jesnoch", "edc"]));
test("footer partner logos are the six required organisations", () => assert.deepEqual(FOOTER_PARTNERS.map((p) => p.id), ["agra", "gates", "german", "kfw", "rockefeller", "uk"]));
test("every referenced partner logo file exists", () => { for (const p of [...HEADER_PARTNERS, ...FOOTER_PARTNERS]) assert.ok(statSync(path.join("public", p.logo!)).size > 1000, String(p.logo)); });

// ───────── Google private key tolerance ─────────
import { generateKeyPairSync } from "node:crypto";
import { explainKeyProblem, normalizePrivateKey } from "../lib/google-sheets/key";
const KEY = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } }).privateKey.trim();
test("every common way of pasting the Google key is accepted", () => {
  const forms: Record<string, string> = {
    "one line with \\n": KEY.replace(/\n/g, "\\n"),
    "one line with \\n, double quotes": `"${KEY.replace(/\n/g, "\\n")}"`,
    "single quotes": `'${KEY.replace(/\n/g, "\\n")}'`,
    "real line breaks": KEY,
    "real line breaks in quotes": `"${KEY}"`,
    "Windows line endings": KEY.replace(/\n/g, "\r\n"),
    "spaces instead of line breaks": KEY.replace(/\n/g, " "),
    "double-escaped \\\\n": KEY.replace(/\n/g, "\\\\n"),
    "whole JSON file pasted": JSON.stringify({ type: "service_account", private_key: KEY }),
    "leading/trailing spaces": `   ${KEY}   `,
  };
  for (const [name, raw] of Object.entries(forms)) { assert.equal(explainKeyProblem(raw), null, name); assert.equal(normalizePrivateKey(raw), KEY + "\n", name); }
});
test("broken Google keys give a plain-English reason", () => {
  assert.match(explainKeyProblem("")!, /empty/);
  assert.match(explainKeyProblem("MIIEvQIBADANBgkq")!, /does not start with/);
  assert.match(explainKeyProblem(KEY.split("\n")[0])!, /cut off/);                         // only the first line survived (multi-line .env)
  assert.match(explainKeyProblem(KEY.slice(0, 200).replace(/\n/g, "\\n") + "\\n-----END PRIVATE KEY-----")!, /incomplete/);
  const damaged = KEY.replace(/\n/g, "\\n").replace("MII", "MIX");
  assert.ok(explainKeyProblem(damaged) !== null);
});


// ───────── roles & permissions ─────────
import { can, homeFor, isPanelRole, ROLE_PERMISSIONS } from "../lib/auth/permissions";
test("roles: judges and reviewers see only assigned applications, never lists, analytics or exports", () => {
  for (const r of ["JUDGE", "REVIEWER"] as const) {
    assert.ok(can(r, "applications:view-assigned") && can(r, "scores:submit")); assert.ok(isPanelRole(r));
    for (const p of ["applications:view", "analytics:view", "export:data", "mentors:review", "ai:query", "applications:status"] as const) assert.equal(can(r, p), false, `${r} must not have ${p}`);
  }
  assert.ok(can("ADMIN", "ai:query") && can("COORDINATOR", "ai:query") && can("COORDINATOR", "export:data"));
  assert.equal(can("COORDINATOR", "config:manage"), false);
  assert.deepEqual([homeFor("ADMIN"), homeFor("COORDINATOR"), homeFor("JUDGE"), homeFor("REVIEWER")], ["/admin", "/admin", "/judge", "/review"]);
  assert.equal(Object.keys(ROLE_PERMISSIONS).length, 4);
});

// ───────── scoring (Contest Design Framework section 6, 7.1) ─────────
import { bandFor, compareRanked, weightedTotal } from "../lib/scoring";
import { DEFAULT_CRITERIA } from "../config/scoring";
test("rubric weights are the framework's 30/25/25/10/10 and total 100", () => {
  assert.deepEqual(DEFAULT_CRITERIA.map((c) => [c.id, c.weight]), [["originality", 30], ["feasibility", 25], ["scalability", 25], ["impact", 10], ["market", 10]]);
  assert.equal(DEFAULT_CRITERIA.reduce((n, c) => n + c.weight, 0), 100);
});
test("weighted total is out of 100 and never counts a missing score as zero", () => {
  assert.equal(weightedTotal({ originality: 10, feasibility: 10, scalability: 10, impact: 10, market: 10 }), 100);
  assert.equal(weightedTotal({ originality: 5, feasibility: 5, scalability: 5, impact: 5, market: 5 }), 50);
  assert.equal(weightedTotal({ originality: 8, feasibility: 6, scalability: 7, impact: 9, market: 4 }), 24 + 15 + 17.5 + 9 + 4);
  assert.equal(weightedTotal({ originality: 8, feasibility: 6, scalability: 7, impact: 9 }), null);   // market missing
  assert.equal(weightedTotal({ originality: 11, feasibility: 6, scalability: 7, impact: 9, market: 4 }), null); // out of range
  assert.equal(bandFor(9), "Exceptional"); assert.equal(bandFor(7), "Strong"); assert.equal(bandFor(2), "Insufficient");
});
test("ties are broken by originality, then scalability, then feasibility", () => {
  const a = { id: "a", total: 70, raw: { originality: 8, scalability: 6, feasibility: 6 } }, b = { id: "b", total: 70, raw: { originality: 7, scalability: 9, feasibility: 9 } };
  assert.ok(compareRanked(a, b) < 0);
  const c = { id: "c", total: 70, raw: { originality: 8, scalability: 7, feasibility: 1 } }; assert.ok(compareRanked(c, a) < 0);
  const d = { id: "d", total: 70, raw: { originality: 8, scalability: 6, feasibility: 7 } }; assert.ok(compareRanked(d, a) < 0);
  assert.equal(compareRanked(a, { ...a, id: "z" }), 0);
});

// ───────── Redis / KV layer (in-memory path) ─────────
import { kv } from "../lib/kv";
import { classifyError } from "../lib/http";
test("kv: counters expire, set-if-absent is atomic, sets dedupe", async () => {
  assert.equal(await kv.incr("t:c", 60), 1); assert.equal(await kv.incr("t:c", 60), 2); assert.ok((await kv.ttl("t:c")) > 0);
  assert.equal(await kv.set("t:nx", "a", { nx: true }), true); assert.equal(await kv.set("t:nx", "b", { nx: true }), false); assert.equal(await kv.get("t:nx"), "a");
  assert.equal(await kv.sadd("t:s", "x"), true); assert.equal(await kv.sadd("t:s", "x"), false); await kv.srem("t:s", "x"); assert.equal(await kv.sadd("t:s", "x"), true);
});
test("errors are classified into safe codes", () => {
  assert.equal(classifyError(new Error("DATA_BACKEND=local is not allowed in production.")), "STORE_NOT_CONFIGURED");
  assert.equal(classifyError(new Error("Google Sheets key problem: cut off")), "GOOGLE_KEY");
  assert.equal(classifyError({ message: "x", response: { status: 403, data: { error: { message: "The caller does not have permission" } } } }), "SHEET_NOT_SHARED");
  assert.equal(classifyError({ message: "Unable to parse range: Drafts!A1" }), "SHEET_TAB_MISSING");
  assert.equal(classifyError({ message: "x", response: { status: 429 } }), "SHEET_QUOTA");
  assert.equal(classifyError(new Error("fetch failed")), "NETWORK"); assert.equal(classifyError(new Error("weird")), "UNKNOWN");
});

// ───────── assistant knowledge ─────────
import { basicAnswer, rank } from "../lib/assistant/retrieve";
import { KNOWLEDGE } from "../config/knowledge";
test("assistant: visitors get programme answers and never staff-only entries", () => {
  assert.match(basicAnswer("Who can apply?")!.answer, /aged 18 to 35/);
  assert.match(basicAnswer("when is the deadline")!.answer, /Applications/);
  assert.equal(rank("what is the scoring rubric").some((r) => r.entry.audience !== "public"), false);
  assert.equal(rank("how do i export a csv of applications").some((r) => r.entry.audience === "admin"), false);
});
test("assistant: judges see the rubric but not admin tools; admins see everything", () => {
  assert.match(basicAnswer("what is the scoring rubric", "JUDGE")!.answer, /Originality 30%/);
  assert.equal(rank("how do i export csv", "REVIEWER").some((r) => r.entry.audience === "admin"), false);
  assert.ok(rank("how do i export csv", "ADMIN").some((r) => r.entry.id === "export"));
  assert.equal(basicAnswer("zzzz qqqq"), null);
});
test("assistant knowledge never states a quota, focal state or invented amount", () => {
  const all = KNOWLEDGE.map((k) => `${k.q} ${k.a()}`).join(" ");
  assert.ok(!/\b(60|40)\s?%/.test(all) && !/focal/i.test(all) && !/₦\s?\d/.test(all));
});


// ───────── password reset (logic runs on the in-memory KV in tests) ─────────
import { consumeResetToken, createResetToken, passwordProblem, sessionRevoked } from "../lib/auth/passwords";
test("password rules", () => {
  assert.ok(passwordProblem("short")); assert.ok(passwordProblem("aaaaaaaaaaaa")); assert.ok(passwordProblem("password123"));
  assert.ok(passwordProblem("ada.obi-2026-x", "ada.obi@example.org")); assert.equal(passwordProblem("green maize fields at dawn"), null);
});
test("reset link: works once, sets a new password, rejects reuse and bad tokens", async () => {
  const { token, expiresAt } = await createResetToken("Reviewer@Example.org");
  assert.ok(token.length >= 40 && Date.parse(expiresAt) > Date.now());
  assert.equal((await consumeResetToken(token, "short")).ok, false);                       // weak password: link stays valid
  const r = await consumeResetToken(token, "green maize fields at dawn"); assert.equal(r.ok, true); if (r.ok) assert.equal(r.email, "reviewer@example.org");
  const again = await consumeResetToken(token, "another long password 2"); assert.equal(again.ok, false);   // single use
  assert.equal((await consumeResetToken("x".repeat(43), "another long password 2")).ok, false);
});
test("sessions issued before a reset are treated as revoked (only when Redis is on)", async () => {
  assert.equal(await sessionRevoked("reviewer@example.org", Math.floor(Date.now() / 1000) - 3600), false); // Redis off in tests → never revoked
});

// ───────── system check: form-to-sheet round trip ─────────
import { mappingRoundTrip } from "../lib/selftest/mapping";
test("system check: a full application converts to a sheet row and back", () => { const m = mappingRoundTrip(); assert.equal(m.ok, true, m.detail); assert.match(m.detail, /74 cells/); });

test("panel form: a page opened before the update gets 'please refresh', not errors for fields it does not have", async () => {
  const { submitMentor } = await import("../lib/services/mentorService");
  const r = await submitMentor({ fullName: "Ada Obi", roles: ["MENTOR", "JUDGE"], email: "ada@example.org" });
  assert.equal(r.ok, false); if (!r.ok) { assert.equal(r.status, 409); assert.equal(r.body.code, "FORM_UPDATED"); assert.match(String(r.body.message), /refresh the page/); }
});
