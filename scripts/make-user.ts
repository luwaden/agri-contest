/**
 * Creates (or updates) a staff account directly in the "Admin Users" tab of your Google Sheet.
 *   npm run make-user -- "ada@example.org" "Ada Obi" REVIEWER "a-long-password"
 * Roles: ADMIN | COORDINATOR | JUDGE | REVIEWER.  The person can sign in straight away: no redeploy.
 *
 * Break-glass (no sheet, or the sheet is broken): add --env to print an entry for the ADMIN_USERS_JSON setting instead.
 */
import "./loadEnv";   // loads .env / .env.local exactly like Next.js. Must stay FIRST
import { envHint } from "./loadEnv";
import bcrypt from "bcryptjs";
import { envSafeHash, findStaff, parseEnvAccounts, upsertSheetAccount } from "../lib/auth/users";
import { passwordProblem } from "../lib/auth/passwords";
import type { StaffRole } from "../types/user";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ENV_ONLY = process.argv.includes("--env");
const [rawEmail, name, rawRole, password] = args;
const ROLES = ["ADMIN", "COORDINATOR", "JUDGE", "REVIEWER"];
const email = (rawEmail ?? "").trim().toLowerCase(); const role = (rawRole ?? "").toUpperCase() as StaffRole;
const fail = (m: string) => { console.error(`\n✘ ${m}\n\nUsage: npm run make-user -- "email" "Full Name" ROLE "password"\n       ROLE is one of: ${ROLES.join(", ")}\n`); process.exit(1); };

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Please give a valid email address as the first value.");
if (!name || name.trim().length < 2) fail("Please give the person's full name as the second value (in quotes).");
if (!ROLES.includes(role)) fail(`The third value must be a role: ${ROLES.join(", ")}.`);
const weak = passwordProblem(password ?? "", email); if (weak) fail(`Password: ${weak}`);

const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const backend = process.env.DATA_BACKEND || (process.env.GOOGLE_SHEET_ID ? "sheets" : process.env.APPS_SCRIPT_URL ? "appsscript" : "local");

async function main() {
  if (ENV_ONLY) {
    const entry = { email, name: name.trim(), role, passwordHash: envSafeHash(bcrypt.hashSync(password, 12)) };
    console.log("\nBreak-glass account for the ADMIN_USERS_JSON setting. Add this object inside the [ ] list (all on ONE line):\n");
    console.log(JSON.stringify(entry));
    console.log("\nThe hash starts with b64: so it contains no $ signs: paste it exactly the same in .env and on Vercel, then redeploy.\n");
    return;
  }
  console.log(`\nSaving ${name.trim()} (${role}) to: ${backend === "local" ? "the LOCAL test store (.data folder). Set DATA_BACKEND=sheets to use the Google Sheet" : `the "Admin Users" tab of your Google Sheet (${backend})`}…`);
  if (backend === "local" && !process.env.DATA_BACKEND) console.log(`  Note: no Google settings found. ${envHint()}`);

  const what = await upsertSheetAccount({ email, name: name.trim(), role, password });
  const saved = await findStaff(email, true);
  const works = saved ? await bcrypt.compare(password, saved.passwordHash) : false;

  const env = parseEnvAccounts();
  const shadowed = env.accounts.some((a) => a.email === email);
  if (saved?.source === "env" || shadowed) {
    console.log(`\n⚠ ${email} is ALSO in your ADMIN_USERS_JSON setting, and that one takes priority at sign-in.`);
    console.log("  Remove that entry from ADMIN_USERS_JSON (in .env and on Vercel), or sign in with the password set there.");
  }
  if (!works && !shadowed) { console.error("\n✘ The account was written but the password could not be verified when read back. Run npm run check:system."); process.exit(1); }

  console.log(`\n✔ ${what === "created" ? "Created" : "Updated"}: ${name.trim()} <${email}> as ${role}.`);
  if (!shadowed) console.log("✔ Read back from the store and the password verified.");
  console.log(`\nThey can sign in now at ${site}/admin/login  (no redeploy needed).`);
  console.log("Send them the password privately. They can change it later with a reset link from Admin → Staff.\n");
}
main().catch((e) => {
  const m = String(e?.message ?? e);
  console.error(`\n✘ Could not save the account: ${m.slice(0, 300)}`);
  if (/permission|403/i.test(m)) console.error("  → Share the Google Sheet with your service-account email as Editor.");
  else if (/parse range|Admin Users/i.test(m)) console.error('  → The "Admin Users" tab is missing. Run: npm run setup:sheets');
  else if (/key problem|DECODER/i.test(m)) console.error("  → Your GOOGLE_PRIVATE_KEY is damaged. Run: npm run check:google");
  console.error("  Run npm run check:system for a full diagnosis.\n");
  process.exit(1);
});
