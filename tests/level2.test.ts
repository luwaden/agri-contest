import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { variedApplications } from "./helpers/varied";
import { LEVEL2_COLUMNS, LEVEL2_HEADERS, level2ToRow, rowToLevel2 } from "../lib/google-sheets/level2Schema";
import { validateLevel2 } from "../lib/validation/level2";
import { uploadFolder } from "../lib/cloudinary/folders";

process.chdir(mkdtempSync(path.join(tmpdir(), "level2-test-")));
Object.assign(process.env, { DATA_BACKEND: "local", SESSION_SECRET: "x".repeat(40) });
delete process.env.NEXT_PUBLIC_DEMO_MODE; delete process.env.LEVEL2_CLOSE_DATE; delete process.env.RESEND_API_KEY; delete process.env.GMAIL_USER;

const apps = variedApplications(40, 12);
apps[0].applicant.age = 31; apps[0].location.state = "Kaduna"; apps[0].business.valueChain = "RICE";
apps[5].submissionStatus = "DRAFT";
mkdirSync(".data", { recursive: true });
writeFileSync(".data/dev-store.json", JSON.stringify({ applications: apps, drafts: [], events: [], staff: [], reviews: [] }));

const good = (over: Record<string, unknown> = {}) => ({
  businessName: "Green Rice Mills", yearEstablished: "2021", contactName: "Amina Bello", phone: "08031234567", email: "amina@example.org",
  state: "Kaduna", lga: "Zaria", community: "Samaru", setting: "RURAL", ownerGender: "FEMALE", ownerAge: "29_35", disability: "NO", ownerEducation: "UNIVERSITY",
  cropType: "RICE", hasCac: "YES", registrationType: "LIMITED_LIABILITY", permanentEmployees: "4", casualEmployees: "10", trainedInputDistribution: "YES",
  inAssociation: "YES", associationName: "Kaduna Rice Farmers Association", farmersServed: "350", agraSupport: "NO", hasBusinessBankAccount: "YES",
  needFinance: "YES", needMarket: "YES", needBds: "NO", needTechnical: "YES", hasOtherNeeds: "NO",
  doc1: "https://res.cloudinary.com/demo/raw/upload/proposal.pdf", cacCertificate: "https://res.cloudinary.com/demo/raw/upload/cac.pdf", declaration: true, ...over,
});

test("the form asks each question once and keeps the sheet layout stable", () => {
  const headers = LEVEL2_HEADERS; assert.equal(new Set(headers).size, headers.length, "no repeated column");
  for (const h of ["contact_name", "state", "rural_or_urban", "level1_code"]) assert.equal(headers.filter((x) => x === h).length, 1, h);
  assert.equal(headers[0], "level1_code");
  const row = level2ToRow({ ...(good() as any), level1Code: "AGRA-2026-AAAAA2", submittedAt: "2026-10-23T20:00:00Z", level1Email: "a@example.org", businessName: "=HYPERLINK(\"x\")" });
  assert.equal(row.length, LEVEL2_COLUMNS.length); assert.ok(row[3].startsWith("'="), "formula guard");
  assert.equal(rowToLevel2(row)!.businessName, "=HYPERLINK(\"x\")", "round trip");
});

test("validation: required answers, follow-up questions, and documents", () => {
  assert.equal(validateLevel2(good()).ok, true);
  const e = (o: Record<string, unknown>) => (validateLevel2(good(o)) as { errors: Record<string, string> }).errors;
  assert.match(e({ associationName: "" }).associationName, /name of the association/);
  assert.match(e({ cropType: "OTHER" }).cropTypeOther, /which crop/);
  assert.match(e({ registrationType: "OTHER" }).registrationTypeOther, /describe/);
  assert.match(e({ hasOtherNeeds: "YES" }).otherNeeds, /other business needs/);
  assert.match(e({ doc1: "" }).doc1, /at least one supporting document/);
  assert.match(e({ cacCertificate: "" }).cacCertificate, /upload it/);
  assert.equal(validateLevel2(good({ hasCac: "NO", registrationType: "NOT_APPLICABLE", cacCertificate: "" })).ok, true, "no CAC → no CAC upload needed");
  assert.match(e({ doc1: "http://insecure.example/x.pdf" }).doc1, /https/);
  assert.match(e({ yearEstablished: "2090" }).yearEstablished, /between 1950/);
  assert.match(e({ declaration: false }).declaration, /tick the box/);
});

test("only invited Level 1 codes with the matching email get in; once per code; the pass cannot be forged", async () => {
  const S = await import("../lib/services/level2Service");
  const { issueLevel2Token, readLevel2Token } = await import("../lib/level2/token");
  const a = apps[0], code = a.applicationId, email = a.applicant.email;

  const wrongEmail = await S.startLevel2({ code, email: "someone@else.org" });
  const unknown = await S.startLevel2({ code: "AGRA-2026-ZZZZZ2", email });
  assert.equal(wrongEmail.status, 404); assert.equal((wrongEmail as any).body.message, (unknown as any).body.message, "same answer: nobody can tell which codes exist");
  assert.equal((await S.startLevel2({ code, email })).status, 403, "not invited yet");

  const inv = await S.inviteLevel2(`${code}\n${apps[1].applicationId}, ${apps[5].applicationId}\nAGRA-2026-NOPE22 junk ${code}`, "admin@example.org", "Focal 180");
  assert.ok(inv.ok); assert.deepEqual([(inv as any).data.added, (inv as any).data.notFound.length], [2, 1], "drafts and unknown codes are not invited");
  const again = await S.inviteLevel2(code, "admin@example.org"); assert.deepEqual([(again as any).data.added, (again as any).data.already], [0, 1]);

  const st = await S.startLevel2({ code: code.toLowerCase(), email: ` ${email.toUpperCase()} ` });
  assert.ok(st.ok); const { token, prefill } = (st as any).data;
  assert.equal(prefill.contactName, `${a.applicant.firstName} ${a.applicant.lastName}`.replace(/\s+/g, " ").trim());
  assert.deepEqual([prefill.state, prefill.ownerAge, prefill.cropType, prefill.businessName], ["Kaduna", "29_35", "RICE", a.business.businessName]);

  assert.equal((await S.submitLevel2("forged.token", good())).status, 401);
  const [payload] = token.split("."); assert.equal(readLevel2Token(`${payload}.AAAA`), null, "edited signature rejected");
  assert.equal(readLevel2Token(token, Date.now() + 4 * 3600_000), null, "expires after 3 hours");
  assert.equal((await S.submitLevel2(token, good({ doc1: "" }))).status, 422);
  const ok = await S.submitLevel2(token, good()); assert.equal(ok.status, 201);
  assert.equal((await S.submitLevel2(token, good())).status, 409, "one submission per code");
  assert.equal((await S.startLevel2({ code, email })).status, 409);
  const uninvited = issueLevel2Token(apps[2].applicationId, apps[2].applicant.email);   // even a genuine pass for an uninvited code is refused
  assert.equal((await S.submitLevel2(uninvited, good())).status, 403);

  const o = await S.level2Overview();
  assert.deepEqual([o.invited, o.submitted, o.waiting.length], [2, 1, 1]);
  const csv = await S.level2Csv();
  assert.equal(csv.rows, 1); assert.ok(csv.csv.startsWith(`﻿${LEVEL2_HEADERS.join(",")}`)); assert.ok(csv.csv.includes(code) && csv.csv.includes("Kaduna Rice Farmers Association"));
  const { getRepository } = await import("../lib/repository");
  const row = (await getRepository().getLevel2Applications())[0];
  assert.deepEqual([row.level1Code, row.level1Email, row.contactName], [code, email.toLowerCase(), "Amina Bello"]);
});

test("closing date and upload folders", async () => {
  const S = await import("../lib/services/level2Service");
  process.env.LEVEL2_CLOSE_DATE = "2020-01-01T00:00:00+01:00";
  try { assert.equal((await S.startLevel2({ code: apps[1].applicationId, email: apps[1].applicant.email })).status, 403); }
  finally { delete process.env.LEVEL2_CLOSE_DATE; }
  assert.match(uploadFolder("level2", "AGRA-2026-K7QX4M"), /\/level-2\/AGRA-2026-K7QX4M$/);
  assert.throws(() => uploadFolder("level2", "../../etc"));
});

test("LEVEL2_OPEN_TO_ALL lets any Level 1 applicant in (code + email still required)", async () => {
  const S = await import("../lib/services/level2Service");
  const a = apps[7];
  assert.equal((await S.startLevel2({ code: a.applicationId, email: a.applicant.email })).status, 403);
  process.env.LEVEL2_OPEN_TO_ALL = "true";
  try {
    assert.ok((await S.startLevel2({ code: a.applicationId, email: a.applicant.email })).ok);
    assert.equal((await S.startLevel2({ code: a.applicationId, email: "x@y.org" })).status, 404);
  } finally { delete process.env.LEVEL2_OPEN_TO_ALL; }
});

test("codes and emails pasted with long dashes, spaces or invisible characters still work", async () => {
  const S = await import("../lib/services/level2Service");
  const a = apps[8]; process.env.LEVEL2_OPEN_TO_ALL = "true";
  try {
    const messy = ` ${a.applicationId.replace(/-/g, "\u2013").replace("2026", "20 26")}\u200B `;
    assert.ok((await S.startLevel2({ code: messy, email: `\u00A0${a.applicant.email.toUpperCase()}\u200B` })).ok);
  } finally { delete process.env.LEVEL2_OPEN_TO_ALL; }
});
