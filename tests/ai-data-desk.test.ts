import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { variedApplications } from "./helpers/varied";
import { applicationToRow, HEADERS, SHEETS } from "../lib/google-sheets/schema";
import { can } from "../lib/auth/permissions";

// A pretend Google spreadsheet behind the REAL Sheets client: it records every request.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
Object.assign(process.env, { DATA_BACKEND: "sheets", GOOGLE_SHEET_ID: "SHEET", GOOGLE_SERVICE_ACCOUNT_EMAIL: "x@y.iam.gserviceaccount.com", GOOGLE_PRIVATE_KEY: privateKey,
  AI_PROVIDER: "claude", ANTHROPIC_API_KEY: "test", ANTHROPIC_MODEL: "test-model" });
delete process.env.AI_FULL_DATA_ACCESS; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.KV_REST_API_URL; delete process.env.ADMIN_USERS_JSON;

const apps = variedApplications(800, 4);
const tabs = new Map<string, string[][]>(Object.entries(HEADERS).map(([k, v]) => [k, [[...v]]]));
tabs.get(SHEETS.applications)!.push(...apps.map(applicationToRow));
let nextId = 100;
(GoogleAuth.prototype as unknown as { getClient: unknown }).getClient = async () => ({
  request: async (o: { url: string; method: string; data?: any }) => {
    const u = decodeURIComponent(o.url.replace(/^.*SHEET/, ""));
    if (o.method === "GET" && u === "") return { data: { sheets: [...tabs].map(([title, r], i) => ({ properties: { title, sheetId: i, gridProperties: { rowCount: r.length + 100 } } })) } };
    if (o.method === "POST" && u === ":batchUpdate") {
      const title = o.data.requests[0].addSheet.properties.title as string;
      if (tabs.has(title)) throw Object.assign(new Error("exists"), { response: { status: 400 } });
      tabs.set(title, []); return { data: { replies: [{ addSheet: { properties: { sheetId: nextId++, title } } }] } };
    }
    const m = /^\/values\/'?(.+?)'?!A(\d+)(?::ZZ(\d+))?(:append)?$/.exec(u) ?? /^\/values\/(.+?)()()()$/.exec(u);
    if (!m) throw new Error(`unexpected ${o.method} ${u}`);
    const name = m[1].replace(/''/g, "'"); const tab = tabs.get(name); if (!tab) throw Object.assign(new Error("Unable to parse range"), { response: { status: 400 } });
    if (o.method === "GET") return { data: { values: m[3] ? tab.slice(+m[2] - 1, +m[3]) : tab } };
    if (m[4]) { tab.push(...o.data.values); return { data: {} }; }                     // append (audit log)
    if (o.method === "PUT") { o.data.values.forEach((r: string[], i: number) => { tab[+m[2] - 1 + i] = r; }); return { data: {} }; }
    throw new Error(`unexpected ${o.method} ${u}`);
  },
});

// A scripted AI: answers with the next tool call, and records everything it was sent.
let script: string[] = []; const sentToAI: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
  if (String(url).includes("/v1/messages")) { sentToAI.push(String(init?.body ?? "")); return new Response(JSON.stringify({ content: [{ type: "text", text: script.shift() ?? '{"answer":"done"}' }] }), { status: 200 }); }
  return realFetch(url as string, init);
}) as typeof fetch;

const snapshot = () => JSON.stringify([...tabs].filter(([t]) => !t.startsWith("AI · ") && t !== SHEETS.events));

test("only administrators have the AI data desk", () => {
  assert.equal(can("ADMIN", "ai:data"), true);
  for (const r of ["COORDINATOR", "JUDGE", "REVIEWER"] as const) assert.equal(can(r, "ai:data"), false, r);
});

test("reads everything, writes only a NEW tab, and personal details stay out of the AI unless switched on", async () => {
  const { askDataDesk } = await import("../lib/services/aiDataDesk");
  const before = snapshot();
  const focal = apps.filter((a) => ["Kaduna", "Niger", "Nasarawa"].includes(a.location.state));
  script = [
    '{"tool":"count","args":{"filters":[{"field":"eligible","op":"eq","value":true}],"group_by":"gender"}}',
    '{"tool":"search","args":{"filters":[{"field":"focal_state","op":"eq","value":true}],"sort":[{"field":"pre_score","desc":true}],"fields":["application_id","business_name","pre_score","phone"],"limit":5}}',
    '{"tool":"search","args":{"filters":[{"field":"focal_state","op":"eq","value":true}],"sort":[{"field":"pre_score","desc":true}],"fields":["application_id","business_name","pre_score"],"limit":5}}',
    // The AI even tries to name its sheet after a data tab: it must still get a NEW tab.
    '{"tool":"create_sheet","args":{"title":"Applications","filters":[{"field":"focal_state","op":"eq","value":true}],"sort":[{"field":"pre_score","desc":true}],"fields":["application_id","first_name","last_name","phone","email","state","pre_score"]}}',
    '{"tool":"delete_rows","args":{"tab":"Applications"}}',
    '{"answer":"I created a sheet of the focal-state applicants, best first."}',
  ];
  const r = await askDataDesk("Make a sheet of all focal-state applicants with contact details, best first", [], "admin@example.org");
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.data.answer, "I created a sheet of the focal-state applicants, best first.");
  assert.match(r.data.steps[1], /personal data and is not shared with the AI/);
  assert.match(r.data.steps[4], /Unknown tool "delete_rows"/);

  // 1. Existing data: untouched, byte for byte.
  assert.equal(snapshot(), before, "an existing tab changed");
  // 2. Exactly one new tab, named "AI · …", holding what was asked for (contact details included).
  const created = [...tabs.keys()].filter((t) => t.startsWith("AI · "));
  assert.equal(created.length, 1); assert.match(created[0], /^AI · Applications · /);
  const sheet = tabs.get(created[0])!;
  assert.deepEqual(sheet[0], ["#", "application_id", "first_name", "last_name", "phone", "email", "state", "pre_score"]);
  assert.equal(sheet.length - 1, focal.length); assert.equal(r.data.outputs[0].rows, focal.length);
  const scores = sheet.slice(1).map((x) => Number(x[7])); assert.deepEqual(scores, [...scores].sort((a, b) => b - a), "best first");
  assert.ok(r.data.outputs[0].url?.includes("#gid="));
  // 3. The AI never saw a phone number or email (they are only in the new tab).
  const toAI = sentToAI.join("\n");
  for (const a of focal.slice(0, 50)) { assert.ok(!toAI.includes(a.applicant.email), "email reached the AI"); assert.ok(!toAI.includes(a.applicant.phone), "phone reached the AI"); }
  // 4. Logged.
  const events = tabs.get(SHEETS.events)!.map((e) => e[3]);
  assert.ok(events.includes("AI_SHEET_CREATED") && events.includes("AI_DATA_QUERY"));
});

test("with AI_FULL_DATA_ACCESS=true the AI may read contact details (still no way to change data)", async () => {
  process.env.AI_FULL_DATA_ACCESS = "true";
  try {
    const { askDataDesk } = await import("../lib/services/aiDataDesk");
    const before = snapshot(); sentToAI.length = 0;
    script = [`{"tool":"get_application","args":{"application_id":"${apps[0].applicationId}"}}`, '{"answer":"ok"}'];
    const r = await askDataDesk("Show me the first application in full", [], "admin@example.org");
    assert.ok(r.ok);
    assert.ok(sentToAI.join("\n").includes(apps[0].applicant.email), "with the switch on, the AI receives the email");
    assert.equal(snapshot(), before);
  } finally { delete process.env.AI_FULL_DATA_ACCESS; }
});

test("the new-tab writer refuses existing names and only ever adds", async () => {
  const { createOutputTab, outputTabName, OUTPUT_PREFIX } = await import("../lib/google-sheets/outputTabs");
  assert.ok(outputTabName("Applications").startsWith(OUTPUT_PREFIX));
  const before = snapshot();
  const a = await createOutputTab("Same title", ["x"], [["=SUM(1)"], ["ok"]]);
  const b = await createOutputTab("Same title", ["x"], [["2"]]);
  assert.notEqual(a.tab, b.tab, "same title twice gives two different new tabs");
  assert.equal(tabs.get(a.tab)![1][0], "'=SUM(1)", "formulas are stored as text");
  assert.equal(snapshot(), before);
});

test("one balanced_sheet call builds the whole per-state selection; an empty AI reply ends clearly", async () => {
  const { askDataDesk } = await import("../lib/services/aiDataDesk");
  const before = snapshot();
  script = ['{"tool":"balanced_sheet","args":{"title":"Focal 3x5","per_state":{"Kaduna":5,"Niger":5,"Nasarawa":5},"min_women_share":0.2,"min_pwd_share":0.1,"min_each_age_band_share":0.15,"spread_lga":true}}', '{"answer":"Done: 15 applicants."}'];
  const r = await askDataDesk("5 each from Kaduna, Niger, Nasarawa, 20% women, 10% PWD", [], "admin@example.org");
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.data.outputs.length, 1); assert.match(r.data.outputs[0].tab ?? "", /^AI · Focal 3x5/);
  const tab = tabs.get(r.data.outputs[0].tab!)!;
  assert.ok(tab[0].includes("placed_by") && tab[0].includes("age_band"));
  assert.equal(snapshot(), before, "existing tabs untouched");
  script = ["", ""];   // model spends its whole budget and says nothing, twice
  const e = await askDataDesk("anything", [], "admin@example.org");
  assert.ok(e.ok); if (e.ok) assert.match(e.data.answer, /empty reply twice/);
});
