/**
 * ONE command to check everything an application needs, using the settings in your .env file:
 *   npm run check:system
 * Settings · Redis · Google Sheet and every tab's column titles · staff sign-in accounts · a real write-and-read-back
 * (one SYSTEM_CHECK row in "Application Events") · that a full application fits the sheet · the application window.
 * It never adds a fake application. Exit code 0 = all good, 1 = something to fix.
 */
import "./loadEnv";   // loads .env / .env.local exactly like Next.js. Must stay FIRST
import { envFilesFound, envHint, ENV_FOLDER } from "./loadEnv";
import os from "node:os";
import { runSystemCheck } from "../lib/services/systemCheck";
import { loadStaff, summarise } from "../lib/auth/users";
import { APP_VERSION } from "../lib/version";

const ICON = { pass: "✔", warn: "!", fail: "✘" } as const;
const backend = process.env.DATA_BACKEND || (process.env.GOOGLE_SHEET_ID ? "sheets" : process.env.APPS_SCRIPT_URL ? "appsscript" : "local");

async function main() {
  console.log(`\nSystem check · code version ${APP_VERSION}`);
  console.log(`Folder: ${ENV_FOLDER}`);
  console.log(`Settings file: ${envFilesFound.length ? envFilesFound.join(", ") : "NONE"}   Data store: ${backend}${backend === "local" ? "  (⚠ the LOCAL test store, not your Google Sheet)" : ""}\n`);
  if (!envFilesFound.length) console.log(`  ${envHint()}\n`);

  const r = await runSystemCheck(`cli:${os.userInfo().username}`);
  for (const s of r.steps) {
    console.log(`${ICON[s.status]} ${s.label}  (${s.ms} ms)\n    ${s.detail}`);
    if (s.fix) console.log(`    → ${s.fix}`);
  }

  const { accounts } = await loadStaff({ fresh: true }).catch(() => ({ accounts: [] as never[] }));
  if (accounts.length) {
    console.log("\nStaff accounts:");
    for (const a of accounts.map(summarise)) console.log(`  ${a.status === "active" ? "✔" : a.status === "invited" ? "…" : "✘"} ${a.email.padEnd(34)} ${a.role.padEnd(12)} ${a.source === "env" ? "ADMIN_USERS_JSON" : "Admin Users tab"}  ${a.status}`);
  }
  console.log(r.ok ? "\n✔ Everything a submission needs is working (on this computer's settings)." : "\n✘ Something needs fixing: see the ✘ items above.");
  console.log(`Next: check the LIVE site with  npm run check:live -- ${process.env.NEXT_PUBLIC_SITE_URL || "https://your-site.vercel.app"}\n`);
  process.exit(r.ok ? 0 : 1);
}
main().catch((e) => { console.error("\n✘ The check itself crashed:", e?.message ?? e); process.exit(1); });
