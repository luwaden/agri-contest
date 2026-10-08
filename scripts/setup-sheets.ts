/**
 * Creates every required tab with stable headers in your Google Sheet, plus formula-based summary tabs.
 * Safe to re-run any time: it compares row 1 of each tab with what the app expects, only ADDS missing column titles
 * at the end, never moves or deletes data, and tells you exactly what it changed.
 * Usage: npm run setup:sheets            (add --force to overwrite a row 1 that has been edited by hand)
 */
import "./loadEnv";   // side-effect import: loads .env / .env.local exactly like Next.js. Must stay FIRST and must never be removed
import { envHint } from "./loadEnv";
import { GoogleAuth } from "google-auth-library";
import { explainKeyProblem, normalizePrivateKey } from "../lib/google-sheets/key";
import { HEADERS, SHEETS, APPLICATION_COLUMNS, columnLetterFor, colLetter, compareHeaders } from "../lib/google-sheets/schema";
import { FOCAL_STATES } from "../config/admin";
import { NIGERIAN_STATES, GENDERS, VALUE_CHAINS, BUSINESS_STAGES, DISABILITY_OPTIONS, SETTINGS } from "../config/programme";

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const id = process.env.GOOGLE_SHEET_ID;
if (!id || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) { console.error(`Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY first.
  ${envHint()}
  Then run: npm run check:google`); process.exit(1); }
const keyProblem = explainKeyProblem(process.env.GOOGLE_PRIVATE_KEY);
if (keyProblem) { console.error(`\nYour Google private key has a problem:\n  ${keyProblem}\n\nRun "npm run check:google" for a full check.`); process.exit(1); }
const auth = new GoogleAuth({ credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY) }, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });

async function api(path: string, method: string, data?: unknown, params?: Record<string, string>) {
  const c = await auth.getClient();
  return (await c.request<any>({ url: `${BASE}/${id}${path}`, method: method as any, data, params })).data;
}
const A = (h: string) => `${SHEETS.applications}!$${columnLetterFor(h)}$2:$${columnLetterFor(h)}`;
const submitted = `${A("status")},"<>DRAFT",${A("status")},"<>"`;

function summary(title: string, header: string, col: string, values: readonly string[], extra = "") {
  return [[title], [header, "Applications", "Share"], ...values.map((v, i) => [v, `=COUNTIFS(${A(col)},"${v}",${submitted}${extra})`, `=IFERROR(B${i + 3}/COUNTIFS(${submitted}),0)`])];
}

async function main() {
  const meta = await api("", "GET", undefined, { fields: "sheets.properties" });
  const existing = new Set<string>(meta.sheets.map((s: any) => s.properties.title));
  const wanted = Object.values(SHEETS);
  const add = wanted.filter((t) => !existing.has(t)).map((title) => ({ addSheet: { properties: { title } } }));
  if (add.length) await api(":batchUpdate", "POST", { requests: add });
  console.log(add.length ? `Created tabs: ${add.map((a) => a.addSheet.properties.title).join(", ")}` : "All tabs already exist.");

  // Read row 1 of every tab in one request, then change only what is needed.
  const FORCE = process.argv.includes("--force");
  const tabs = Object.keys(HEADERS);
  const q = tabs.map((t) => `ranges=${encodeURIComponent(`'${t.replace(/'/g, "''")}'!1:1`)}`).join("&");
  const got = await api(`/values:batchGet?${q}`, "GET");
  let conflicts = 0;
  console.log("\nColumn titles (row 1) of each tab:");
  for (const [i, tab] of tabs.entries()) {
    const headers = [...HEADERS[tab as keyof typeof HEADERS]];
    const current: string[] = got.valueRanges?.[i]?.values?.[0] ?? [];
    const state = compareHeaders(headers, current);
    const write = () => api(`/values/${encodeURIComponent(`${tab}!A1:${colLetter(headers.length - 1)}1`)}`, "PUT", { values: [headers] }, { valueInputOption: "RAW" });
    if (state.kind === "ok") console.log(`  ✔ ${tab}: already up to date (${headers.length} columns)`);
    else if (state.kind === "empty") { await write(); console.log(`  ✔ ${tab}: column titles written (${headers.length} columns)`); }
    else if (state.kind === "append") { await write(); console.log(`  ✔ ${tab}: added ${state.missing.length} new column(s) at the end: ${state.missing.join(", ")}. Existing rows were not touched.`); }
    else if (FORCE) { await write(); console.log(`  ⚠ ${tab}: row 1 had been edited; overwritten because of --force (data rows untouched).`); }
    else { conflicts++; console.log(`  ✘ ${tab}: row 1 has been edited by hand, so it was NOT changed:\n      ${state.diffs.slice(0, 4).join("\n      ")}\n      → Put the titles back as listed by "npm run print:headers", or re-run with --force (overwrites row 1 only).`); }
  }
  if (conflicts) console.log(`\n${conflicts} tab(s) need attention (see ✘ above). Never reorder columns in a tab that already has data.`);
  const put = (tab: string, rows: string[][]) => api(`/values/${encodeURIComponent(`${tab}!A1`)}`, "PUT", { values: rows }, { valueInputOption: "USER_ENTERED" });
  await put(SHEETS.stateMetrics, [["State metrics (formulas: do not type here)"], ["State", "Location group", "Applications", "Share"],
    ...NIGERIAN_STATES.map((s, i) => [s, (FOCAL_STATES as readonly string[]).includes(s) ? "FOCAL_STATES" : "OTHER_STATES", `=COUNTIFS(${A("state")},A${i + 3},${submitted})`, `=IFERROR(C${i + 3}/COUNTIFS(${submitted}),0)`])]);
  await put(SHEETS.applicantMetrics, [...summary("Applicant metrics (formulas)", "Gender", "gender", GENDERS.map((g) => g.value)), [], ["Total submitted", `=COUNTIFS(${submitted})`]]);
  await put(SHEETS.businessMetrics, [...summary("Business metrics (formulas)", "Value chain", "value_chain", VALUE_CHAINS.map((v) => v.value)), [], ...summary("", "Stage", "business_stage", BUSINESS_STAGES.map((v) => v.value)).slice(1)]);
  await put(SHEETS.inclusionMetrics, [...summary("Inclusion metrics (formulas)", "Disability", "disability", DISABILITY_OPTIONS.map((v) => v.value)), [], ...summary("", "Residence", "residence_setting", SETTINGS.map((v) => v.value)).slice(1),
    [], ["Rural (residence or business)", `=COUNTIFS(${A("rural")},TRUE,${submitted})`]]);
  console.log(`\nDone. Summary tabs (State/Applicant/Business/Inclusion Metrics) refreshed. Next: npm run check:system`);
}
main().catch((e) => { console.error(e?.response?.data ?? e); process.exit(1); });
