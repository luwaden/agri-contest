/**
 * Creates every required tab with stable headers in your Google Sheet, plus formula-based summary tabs.
 * Safe to re-run: existing tabs are kept, and header rows are (re)written.
 * Usage: npm run setup:sheets   (reads .env.local)
 */
import "./loadEnv";   // same loader as the app: .env, .env.local, quotes and multi-line values
import { GoogleAuth } from "google-auth-library";
import { explainKeyProblem, normalizePrivateKey } from "../lib/google-sheets/key";
import { HEADERS, SHEETS, APPLICATION_COLUMNS, columnLetterFor, colLetter } from "../lib/google-sheets/schema";
import { FOCAL_STATES } from "../config/admin";
import { NIGERIAN_STATES, GENDERS, VALUE_CHAINS, BUSINESS_STAGES, DISABILITY_OPTIONS, SETTINGS } from "../config/programme";

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const id = process.env.GOOGLE_SHEET_ID;
if (!id || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) { console.error("Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY first."); process.exit(1); }
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

  for (const [tab, headers] of Object.entries(HEADERS)) {
    await api(`/values/${encodeURIComponent(`${tab}!A1:${colLetter(headers.length - 1)}1`)}`, "PUT", { values: [headers] }, { valueInputOption: "RAW" });
    console.log(`Headers set: ${tab} (${headers.length} columns)`);
  }
  const put = (tab: string, rows: string[][]) => api(`/values/${encodeURIComponent(`${tab}!A1`)}`, "PUT", { values: rows }, { valueInputOption: "USER_ENTERED" });
  await put(SHEETS.stateMetrics, [["State metrics (formulas: do not type here)"], ["State", "Location group", "Applications", "Share"],
    ...NIGERIAN_STATES.map((s, i) => [s, (FOCAL_STATES as readonly string[]).includes(s) ? "FOCAL_STATES" : "OTHER_STATES", `=COUNTIFS(${A("state")},A${i + 3},${submitted})`, `=IFERROR(C${i + 3}/COUNTIFS(${submitted}),0)`])]);
  await put(SHEETS.applicantMetrics, [...summary("Applicant metrics (formulas)", "Gender", "gender", GENDERS.map((g) => g.value)), [], ["Total submitted", `=COUNTIFS(${submitted})`]]);
  await put(SHEETS.businessMetrics, [...summary("Business metrics (formulas)", "Value chain", "value_chain", VALUE_CHAINS.map((v) => v.value)), [], ...summary("", "Stage", "business_stage", BUSINESS_STAGES.map((v) => v.value)).slice(1)]);
  await put(SHEETS.inclusionMetrics, [...summary("Inclusion metrics (formulas)", "Disability", "disability", DISABILITY_OPTIONS.map((v) => v.value)), [], ...summary("", "Residence", "residence_setting", SETTINGS.map((v) => v.value)).slice(1),
    [], ["Rural (residence or business)", `=COUNTIFS(${A("rural")},TRUE,${submitted})`]]);
  console.log(`Done. ${APPLICATION_COLUMNS.length} application columns. The website only reads the Applications tab; other summary tabs are for coordinators and Power BI.`);
}
main().catch((e) => { console.error(e?.response?.data ?? e); process.exit(1); });
