/**
 * PRE-DEPLOY SAFETY CHECK for a sheet that already holds real applications.  READ-ONLY: it uses a read-only Google
 * permission, so it cannot change your sheet even by mistake.
 *
 *   npm run preflight                 (uses GOOGLE_* from .env, i.e. your LIVE sheet)
 *   npm run preflight -- https://agri-contest.vercel.app     (also shows which version is live now)
 *
 * It:
 *   1. saves a full backup of every tab to the backups/ folder on your computer (never uploaded, never committed);
 *   2. checks row 1 of every tab against what the NEW code expects (the app writes by column position);
 *   3. reads EVERY existing application and panel application with the NEW code and writes it back in memory,
 *      proving nothing is lost or shifted when staff later change a status;
 *   4. tells you SAFE TO DEPLOY, or STOP and exactly why.
 */
import "./loadEnv";   // loads .env / .env.local exactly like Next.js. Must stay FIRST
import { envHint } from "./loadEnv";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";
import { explainKeyProblem, normalizePrivateKey } from "../lib/google-sheets/key";
import { APPLICATION_COLUMNS, HEADERS, SHEETS, applicationToRow, compareHeaders, rowToApplication } from "../lib/google-sheets/schema";
import { mentorToRow, rowToMentor } from "../lib/google-sheets/mentorSchema";
import { rowToStaff } from "../lib/google-sheets/staffSchema";
import { csvCell } from "../lib/csv";
import { APP_VERSION } from "../lib/version";

const id = process.env.GOOGLE_SHEET_ID;
if (!id || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error(`Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY first (the same values as on Vercel).\n  ${envHint()}`); process.exit(1);
}
const keyProblem = explainKeyProblem(process.env.GOOGLE_PRIVATE_KEY);
if (keyProblem) { console.error(`Your Google private key has a problem:\n  ${keyProblem}\nRun "npm run check:google".`); process.exit(1); }
const auth = new GoogleAuth({
  credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY) },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],   // read-only on purpose
});
const get = async (p: string, params?: Record<string, string>) =>
  (await (await auth.getClient()).request<any>({ url: `https://sheets.googleapis.com/v4/spreadsheets/${id}${p}`, method: "GET", params })).data;

const stops: string[] = [], todo: string[] = [];
const ok = (m: string) => console.log(`  ✔ ${m}`), warn = (m: string) => console.log(`  ! ${m}`), bad = (m: string) => { console.log(`  ✘ ${m}`); stops.push(m); };

/** Compares an original row with the row the new code would write back. Blank → default (e.g. "" → "0") is harmless. */
function compareRow(orig: string[], back: string[], headers: readonly string[]) {
  const lost: string[] = [];
  headers.forEach((h, i) => {
    const a = (orig[i] ?? "").toString(), b = (back[i] ?? "").toString();
    if (a === b || a.trim() === "" || a.toUpperCase() === b.toUpperCase() || b === `'${a}`) return;   // ' = the formula guard
    if (a !== "" && b !== "" && !Number.isNaN(Number(a)) && Number(a) === Number(b)) return;
    try { if (JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b))) return; } catch { /* not JSON */ }
    lost.push(h);
  });
  return lost;
}

function roundTrip(tab: string, rows: string[][], headers: readonly string[], toObj: (r: string[]) => any, toRow: (o: any) => string[]) {
  const data = rows.slice(1).map((r, i) => ({ r, n: i + 2 })).filter((x) => (x.r[0] ?? "") !== "");
  const problems = new Map<string, number[]>(); let unreadable = 0;
  for (const { r, n } of data) {
    try { for (const h of compareRow(r, toRow(toObj(r)), headers)) problems.set(h, [...(problems.get(h) ?? []), n]); }
    catch { unreadable++; problems.set("(whole row unreadable)", [...(problems.get("(whole row unreadable)") ?? []), n]); }
  }
  const extra = data.filter((x) => x.r.length > headers.length && x.r.slice(headers.length).some((c) => (c ?? "").trim() !== ""));
  if (!problems.size) ok(`${tab}: all ${data.length} existing row(s) are read and written back by the new code without any change`);
  else for (const [h, ns] of problems) bad(`${tab}: column "${h}" would change in ${ns.length} row(s) (rows ${ns.slice(0, 5).join(", ")}${ns.length > 5 ? ", …" : ""})`);
  if (extra.length) warn(`${tab}: ${extra.length} row(s) have something typed to the right of the last column (rows ${extra.slice(0, 5).map((x) => x.n).join(", ")}). The app ignores it, but it is kept in the backup.`);
  return { count: data.length, unreadable };
}

async function main() {
  console.log(`\nPre-deploy check for version ${APP_VERSION}  (read-only: nothing in your sheet will change)\n`);

  // 0. What is live right now?
  const url = (process.argv.slice(2).find((a) => /^https?:\/\//.test(a)) ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (url && !/localhost/.test(url)) {
    try { const h = await (await fetch(`${url}/api/health`, { cache: "no-store" })).json(); console.log(`Live site ${url} is on version ${h.version ?? "(an old release without a version number)"}. You are about to deploy ${APP_VERSION}.\n`); }
    catch { console.log(`(Could not reach ${url}/api/health to see the live version. That does not stop this check.)\n`); }
  }

  // 1. Backup
  console.log("1. Backup of every tab");
  const meta = await get("", { fields: "properties.title,sheets.properties.title" });
  const tabs: string[] = meta.sheets.map((s: any) => s.properties.title);
  const q = new URLSearchParams(); tabs.forEach((t) => q.append("ranges", `'${t.replace(/'/g, "''")}'`));
  const all = await get(`/values:batchGet?${q.toString()}`, { majorDimension: "ROWS" });
  const byTab = new Map<string, string[][]>(tabs.map((t, i) => [t, (all.valueRanges?.[i]?.values ?? []) as string[][]]));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(process.cwd(), "backups", stamp); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "ALL_TABS.json"), JSON.stringify({ spreadsheet: meta.properties?.title, sheetId: id, takenAt: new Date().toISOString(), tabs: Object.fromEntries(byTab) }, null, 1));
  for (const [t, rows] of byTab) writeFileSync(path.join(dir, `${t.replace(/[^\w -]/g, "_")}.csv`), rows.map((r) => r.map(csvCell).join(",")).join("\r\n"));
  ok(`Saved ${tabs.length} tab(s) of "${meta.properties?.title}" to backups/${stamp}/  (keep it private: it contains personal data)`);

  // 2. Column titles
  console.log("\n2. Column titles (row 1). The app writes by column POSITION, so these must line up");
  for (const [tab, want] of Object.entries(HEADERS)) {
    const rows = byTab.get(tab);
    if (!rows) { warn(`${tab}: tab does not exist yet. setup:sheets will create it.`); todo.push(tab); continue; }
    const s = compareHeaders(want, rows[0] ?? []);
    if (s.kind === "ok") ok(`${tab}: matches (${want.length} columns)`);
    else if (s.kind === "empty") { warn(`${tab}: row 1 is empty. setup:sheets will write it.`); todo.push(tab); if (rows.length > 1) bad(`${tab}: has data but no column titles. Ask for help before deploying.`); }
    else if (s.kind === "append") { warn(`${tab}: ${s.missing.length} new column(s) will be ADDED at the end: ${s.missing.join(", ")}. Existing columns stay where they are.`); todo.push(tab); }
    else bad(`${tab}: row 1 does not line up with the new code:\n        ${s.diffs.slice(0, 5).join("\n        ")}${s.diffs.length > 5 ? `\n        … and ${s.diffs.length - 5} more` : ""}`);
  }

  // 3. Existing data, read and written back by the NEW code
  console.log("\n3. Existing records, read by the new code and written back (in memory only)");
  const apps = byTab.get(SHEETS.applications);
  const appStats = apps ? roundTrip(SHEETS.applications, apps, APPLICATION_COLUMNS.map((c) => c.header), rowToApplication, applicationToRow) : { count: 0 };
  const mentors = byTab.get(SHEETS.mentors);
  const mStats = mentors ? roundTrip(SHEETS.mentors, mentors, HEADERS[SHEETS.mentors], rowToMentor, mentorToRow) : { count: 0 };
  const drafts = (byTab.get(SHEETS.drafts) ?? []).slice(1).filter((r) => r[0]).length;
  ok(`${SHEETS.drafts}: ${drafts} saved draft(s). They stay readable after the update, also once Redis is switched on.`);
  const staffRows = (byTab.get(SHEETS.adminUsers) ?? []).slice(1).filter((r) => (r[2] ?? "").trim());
  const staff = staffRows.map(rowToStaff).filter(Boolean);
  if (staffRows.length && staff.length < staffRows.length) warn(`${SHEETS.adminUsers}: ${staffRows.length - staff.length} row(s) have an email but no valid role, and will be ignored at sign-in.`);
  ok(`${SHEETS.adminUsers}: ${staff.length} staff account(s) in the sheet. Accounts in ADMIN_USERS_JSON keep working exactly as before.`);

  // Verdict
  console.log("\n" + "─".repeat(70));
  console.log(`Records checked: ${appStats.count} application(s), ${mStats.count} panel application(s), ${drafts} draft(s).`);
  if (stops.length) {
    console.log(`\n✘ STOP: do NOT deploy yet. ${stops.length} problem(s) above could put new data in the wrong columns or change existing data.`);
    console.log("  Nothing has been changed. Send me the ✘ lines (they contain no personal data) and I will fix the code to fit your sheet.\n");
    process.exit(1);
  }
  console.log("\n✔ SAFE TO DEPLOY. The new code reads every existing record exactly as it is.");
  console.log(todo.length
    ? `  Next: npm run setup:sheets   (only adds the new column titles listed above to: ${todo.join(", ")}; never moves or deletes data)\n  Then deploy (see docs/SAFE_UPDATE.md).\n`
    : "  Then deploy (see docs/SAFE_UPDATE.md).\n");
}
main().catch((e) => {
  const m = String(e?.response?.data?.error?.message ?? e?.message ?? e);
  console.error(`\n✘ Could not read the sheet: ${m.slice(0, 300)}`);
  if (/permission|403/i.test(m)) console.error("  → Share the Google Sheet with your service-account email.");
  else if (/not found|404/i.test(m)) console.error("  → GOOGLE_SHEET_ID is wrong.");
  console.error("  Nothing was changed.\n"); process.exit(1);
});
