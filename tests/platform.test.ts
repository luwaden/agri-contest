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
const mentor = { fullName: "Dr Ada Obi", email: "Ada@Example.com", phone: "+2348031234567", state: "Lagos", location: "Ikeja", profession: "Agri-finance specialist", organization: "AgriBank", industry: "Banking", yearsExperience: "12", mentorshipExperience: "Mentored 6 founders.", expertise: ["FINANCE"], availability: "2_5", availabilityNotes: "", linkedin: "", portfolio: "", motivation: "I want to help young founders become investable.", docCv: "", consent: true };
test("mentor form: valid input passes and is normalised", () => { const r = validateMentor(mentor); assert.equal(r.ok, true); if (r.ok) assert.equal(r.data.email, "ada@example.com"); });
test("mentor form: friendly errors", () => {
  const r = validateMentor({ ...mentor, fullName: "", expertise: [], consent: false, linkedin: "javascript:alert(1)" });
  assert.equal(r.ok, false); if (!r.ok) { assert.equal(r.errors.fullName, "Please enter your full name."); assert.match(r.errors.expertise, /at least one area/); assert.ok(r.errors.consent); assert.ok(r.errors.linkedin); }
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
