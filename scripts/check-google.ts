/**
 * Checks the Google Sheets settings step by step and says exactly what to fix. Run: npm run check:google
 * Nothing is written to your sheet.
 */
import "./loadEnv";   // side-effect import: loads .env / .env.local exactly like Next.js. Must stay FIRST and must never be removed
import { GoogleAuth } from "google-auth-library";
import { explainKeyProblem, normalizePrivateKey } from "../lib/google-sheets/key";
import { HEADERS, SHEETS } from "../lib/google-sheets/schema";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";

const WANT = ["GOOGLE_SHEET_ID", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY"] as const;
const FIX = process.argv.includes("--fix");

/** Reads a settings file whatever its encoding, and says if the encoding will stop Next.js from reading it. */
function readEnvFile(file: string) {
  const buf = readFileSync(file);
  const utf16le = buf[0] === 0xff && buf[1] === 0xfe, utf16be = buf[0] === 0xfe && buf[1] === 0xff;
  const nulls = buf.subarray(0, 200).filter((b) => b === 0).length > 10;
  const bom8 = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const text = utf16le || (nulls && !utf16be) ? buf.toString("utf16le") : utf16be ? Buffer.from(buf).swap16().toString("utf16le") : buf.toString("utf8");
  const clean = text.replace(/^\uFEFF/, "");
  const names = new Map<string, number>();            // variable name -> length of its value (0 = empty)
  for (const m of clean.matchAll(/^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*=(.*)$/gm)) { let v = m[2].trim(); if (!/^["']/.test(v)) v = v.replace(/(^|\s)#.*$/, "").trim(); names.set(m[1], v.replace(/^["']|["']$/g, "").length); }
  return { encodingProblem: utf16le || utf16be || nulls ? "UTF-16" : bom8 ? "UTF-8 with a hidden marker at the start" : null, clean, names };
}

function diagnoseFiles(): boolean {
  console.log(`0. Where the settings come from\n  Folder being checked: ${process.cwd()}`);
  const candidates = [".env", ".env.local"];
  const found = candidates.filter((f) => existsSync(path.join(process.cwd(), f)));
  const typos = [".env.txt", ".env.local.txt", "env", ".env.example.txt"].filter((f) => existsSync(path.join(process.cwd(), f)));
  let problem = false;
  if (found.length === 0) {
    problem = true; console.log("  ✘ No .env or .env.local file in this folder.");
    if (typos.length) console.log(`      → You have "${typos[0]}". Windows is hiding the real extension. Rename it to exactly .env (File Explorer → View → tick "File name extensions").`);
    else console.log("      → Make a file named .env (copy .env.example to .env) in THIS folder, the one that contains package.json. If your .env is in a different folder, open PowerShell there instead.");
    return problem;
  }
  for (const f of found) {
    const info = readEnvFile(path.join(process.cwd(), f));
    console.log(`  ✔ Found ${f} (${info.names.size} settings)`);
    if (info.encodingProblem) {
      problem = true; console.log(`  ✘ ${f} is saved as ${info.encodingProblem}, which Next.js cannot read.`);
      if (FIX && info.encodingProblem !== "UTF-8 with a hidden marker at the start") console.log("      → fixing below");
      if (FIX) { copyFileSync(f, `${f}.backup`); writeFileSync(f, info.clean.replace(/\r\n?/g, "\n"), { encoding: "utf8" }); console.log(`      → Converted ${f} to plain UTF-8. Your original is saved as ${f}.backup. Run this check again.`); }
      else console.log(`      → Run: npm run check:google -- --fix   (converts it safely and keeps a backup).  Or in Notepad: File → Save As → Encoding: UTF-8.`);
    }
    for (const k of WANT) {
      if (!info.names.has(k)) {
        const near = [...info.names.keys()].filter((n) => /google|sheet|private|client|service/i.test(n) && !(WANT as readonly string[]).includes(n));
        console.log(`  ✘ ${k} is not in ${f}.${near.length ? ` Similar names found: ${near.join(", ")} (the spelling must match exactly).` : ""}`); problem = true;
      } else if (info.names.get(k) === 0) { console.log(`  ✘ ${k} is in ${f} but has nothing after the = sign.`); problem = true; }
      else console.log(`  ✔ ${k} has a value (${info.names.get(k)} characters)`);
    }
  }
  if (problem) console.log("\n  Add the three lines with your real values (see step B4 of the guide), save the file, and run this check again.");
  return problem;
}

const ok = (m: string) => console.log(`  ✔ ${m}`);
const bad = (m: string, fix?: string) => { console.log(`  ✘ ${m}`); if (fix) console.log(`      → ${fix}`); };
let failed = false;
const fail = (m: string, fix?: string) => { failed = true; bad(m, fix); };

(async () => {
  console.log("\nGoogle Sheets check\n");
  if (diagnoseFiles()) { console.log(""); process.exit(1); }
  const id = process.env.GOOGLE_SHEET_ID, email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  console.log("\n1. Settings found");
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
