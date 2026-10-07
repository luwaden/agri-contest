/**
 * Checks the Google Sheets settings step by step and says exactly what to fix. Run: npm run check:google
 * Nothing is written to your sheet.
 */
import "./loadEnv";
import { GoogleAuth } from "google-auth-library";
import { explainKeyProblem, normalizePrivateKey } from "../lib/google-sheets/key";
import { HEADERS, SHEETS } from "../lib/google-sheets/schema";

const ok = (m: string) => console.log(`  ✔ ${m}`);
const bad = (m: string, fix?: string) => { console.log(`  ✘ ${m}`); if (fix) console.log(`      → ${fix}`); };
let failed = false;
const fail = (m: string, fix?: string) => { failed = true; bad(m, fix); };

(async () => {
  console.log("\nGoogle Sheets check\n");
  const id = process.env.GOOGLE_SHEET_ID, email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  console.log("1. Settings found");
  id ? ok(`GOOGLE_SHEET_ID (${id.slice(0, 6)}…)`) : fail("GOOGLE_SHEET_ID is missing", "Copy the long id from the sheet's web address, between /d/ and /edit.");
  if (id && (id.includes("/") || id.startsWith("http"))) fail("GOOGLE_SHEET_ID looks like a full link", "Use only the id part, between /d/ and /edit.");
  email ? ok(`GOOGLE_SERVICE_ACCOUNT_EMAIL (${email})`) : fail("GOOGLE_SERVICE_ACCOUNT_EMAIL is missing", "Use the client_email value from the JSON file.");
  if (email && !email.endsWith(".gserviceaccount.com")) fail("The email does not end in .gserviceaccount.com", "Use client_email from the JSON file, not your own Gmail address.");

  console.log("\n2. Private key");
  const problem = explainKeyProblem(process.env.GOOGLE_PRIVATE_KEY);
  if (problem) fail("The key cannot be used", problem); else ok("The key is readable");
  if (failed) { console.log("\nFix the items marked ✘, then run this check again.\n"); process.exit(1); }

  console.log("\n3. Google accepts the login");
  const auth = new GoogleAuth({ credentials: { client_email: email, private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY) }, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  let client;
  try { client = await auth.getClient(); await auth.getAccessToken(); ok("Google issued an access token"); }
  catch (e: any) {
    const m = String(e?.message ?? e);
    if (/invalid_grant|Invalid JWT/i.test(m)) fail("Google rejected the login", "Check your computer's clock is correct, and that the email and key come from the SAME JSON file (not an old, deleted key).");
    else if (/ENOTFOUND|ECONN|ETIMEDOUT|fetch failed|getaddrinfo|Host not in allowlist/i.test(m)) fail("Could not reach Google", "Check your internet connection, VPN or firewall.");
    else fail("Login failed", m.slice(0, 200));
    process.exit(1);
  }

  console.log("\n4. The sheet");
  try {
    const r = await client.request<any>({ url: `https://sheets.googleapis.com/v4/spreadsheets/${id}`, params: { fields: "properties.title,sheets.properties.title" } });
    ok(`Opened "${r.data.properties.title}"`);
    const tabs: string[] = r.data.sheets.map((s: any) => s.properties.title);
    for (const t of [SHEETS.applications, SHEETS.drafts, SHEETS.events, SHEETS.mentors]) tabs.includes(t) ? ok(`Tab "${t}" exists`) : console.log(`  • Tab "${t}" is missing (npm run setup:sheets creates it)`);
    if (tabs.includes(SHEETS.applications)) {
      const h = await client.request<any>({ url: `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(SHEETS.applications + "!A1:A1")}` });
      h.data.values?.[0]?.[0] === HEADERS[SHEETS.applications][0] ? ok("Header row is in place") : console.log('  • Row 1 of "Applications" has no headers yet (npm run setup:sheets writes them)');
    }
  } catch (e: any) {
    const code = e?.response?.status, msg = e?.response?.data?.error?.message ?? String(e?.message ?? e);
    if (code === 403) fail("The robot is not allowed to open this sheet", `In Google Sheets click Share, add ${email} as Editor, then run this check again.`);
    else if (code === 404) fail("Sheet not found", "GOOGLE_SHEET_ID is wrong. Copy it again from the sheet's web address.");
    else if (code === 400 || /API has not been used|disabled/i.test(msg)) fail("Google Sheets API is switched off for this project", "In console.cloud.google.com open APIs & Services → Library → Google Sheets API → Enable.");
    else fail("Could not open the sheet", msg.slice(0, 200));
  }
  console.log(failed ? "\nFix the items marked ✘ and run this check again.\n" : "\nAll good. Run: npm run setup:sheets\n");
  process.exit(failed ? 1 : 0);
})();
