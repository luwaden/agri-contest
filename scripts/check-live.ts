/**
 * Checks the DEPLOYED website from your computer:
 *   npm run check:live -- https://agri-contest.vercel.app
 *   npm run check:live -- https://agri-contest.vercel.app --email you@example.org   (also runs Admin → System check; asks for your password)
 * 1. Is Vercel running the same code version as this folder?   2. Can it reach the Google Sheet and Redis?
 * 3. Do the public pages, styles and logos load?               4. (with --email) the full system check on the live server.
 */
import "./loadEnv";   // loads .env / .env.local (for NEXT_PUBLIC_SITE_URL and HEALTH_CHECK_TOKEN). Must stay FIRST
import readline from "node:readline";
import { APP_VERSION } from "../lib/version";

const argv = process.argv.slice(2);
const base = (argv.find((a) => /^https?:\/\//i.test(a)) || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
const email = argv[argv.indexOf("--email") + 1] && argv.includes("--email") ? argv[argv.indexOf("--email") + 1] : "";
let failed = 0, warned = 0;
const ok = (m: string) => console.log(`  ✔ ${m}`);
const warn = (m: string, fix?: string) => { warned++; console.log(`  ! ${m}${fix ? `\n      → ${fix}` : ""}`); };
const bad = (m: string, fix?: string) => { failed++; console.log(`  ✘ ${m}${fix ? `\n      → ${fix}` : ""}`); };

async function get(path: string, init: RequestInit = {}) {
  const t0 = Date.now();
  const res = await fetch(base + path, { redirect: "manual", ...init, signal: AbortSignal.timeout(25_000), headers: { "User-Agent": "agri-contest-check-live", ...(init.headers ?? {}) } });
  return { res, ms: Date.now() - t0 };
}

function askHidden(question: string): Promise<string> {
  if (process.env.CHECK_PASSWORD) return Promise.resolve(process.env.CHECK_PASSWORD);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const r = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  return new Promise((resolve) => {
    rl.question(question, (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
    r._writeToOutput = (s: string) => { r.output.write(s.includes(question) ? question : s === "\r\n" || s === "\n" ? s : "*"); };
  });
}

async function main() {
  if (!base) { console.error('\nGive the site address, e.g.  npm run check:live -- https://agri-contest.vercel.app\n(or set NEXT_PUBLIC_SITE_URL in your .env)\n'); process.exit(1); }
  console.log(`\nChecking ${base}  ·  this folder's code version: ${APP_VERSION}\n`);

  console.log("1. Which code is live?");
  let health: any = null;
  try { const { res, ms } = await get("/api/health"); health = await res.json(); ok(`Site answers (${ms} ms)`); }
  catch (e) { bad(`The site did not answer: ${(e as Error).message}`, "Check the address. If it is right, open Vercel → Deployments and look for a failed (red) build."); finish(); return; }
  if (!health.version) bad("The live site is running OLD code (from before 8 October: it has no version number). Your latest files are NOT deployed.", "Follow docs/DEPLOY_TO_VERCEL.md, then run this check again.");
  else if (health.version !== APP_VERSION) bad(`Live version ${health.version} (build ${health.commit ?? "?"}) is different from this folder (${APP_VERSION}).`, "Deploy this folder (docs/DEPLOY_TO_VERCEL.md). If you deployed a moment ago, wait for the build to finish.");
  else ok(`Live site runs the same version as this folder: ${APP_VERSION} (build ${health.commit ?? "?"})`);
  const i = health.integrations ?? {};
  console.log(`      data store: ${i.dataStore ?? "?"} · redis: ${i.redis ?? "unknown"} · ai: ${i.ai ?? "?"} · assistant: ${i.assistant ?? "?"}`);
  if (i.dataStore === "local") bad("The live site has no data store configured, so every application fails.", "Add DATA_BACKEND=sheets and the GOOGLE_* settings on Vercel, then redeploy.");
  if (i.redis === false) warn("Redis is not configured on the live site.", "Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on Vercel, then redeploy.");

  console.log("\n2. Can the live site reach the Google Sheet and Redis?");
  try {
    const tok = process.env.HEALTH_CHECK_TOKEN ? `&token=${encodeURIComponent(process.env.HEALTH_CHECK_TOKEN)}` : "";
    const { res } = await get(`/api/health?check=store${tok}`); const h = await res.json();
    if (!h.store) warn("This version cannot run the store check (old code).");
    else if (h.store.ok) {
      ok(`Sheet reachable: ${Object.entries(h.store.tabs ?? {}).map(([t, s]) => `${t} ${s}`).join(", ")}`);
      const issues = Object.entries(h.store.headerIssues ?? {}).filter(([, v]) => v);
      if (issues.length) issues.forEach(([t, v]) => warn(`${t}: ${v}`)); else ok("Column titles of every tab match");
    } else bad(`Store problem: ${h.store.code ?? "unknown"}${h.store.headerProblems?.length ? ` · ${h.store.headerProblems.join("; ")}` : ""}`, h.store.hint);
    if (h.redisStatus === "ok") ok("Redis answers"); else if (h.redisStatus === "off") warn("Redis is off on the live site"); else if (h.redisStatus) bad(`Redis error: ${h.redisStatus}`, "Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN again on Vercel, then redeploy.");
  } catch (e) { bad(`Store check failed: ${(e as Error).message}`); }

  console.log("\n3. Do the pages, styles and logos load?");
  let homeHtml = "";
  for (const p of ["/", "/apply", "/mentors", "/admin/login", "/privacy", "/terms"]) {
    try { const { res, ms } = await get(p); const txt = await res.text(); if (p === "/") homeHtml = txt; res.status === 200 ? ok(`${p} (${ms} ms)`) : bad(`${p} returned HTTP ${res.status}`); }
    catch (e) { bad(`${p}: ${(e as Error).message}`); }
  }
  const css = [...homeHtml.matchAll(/href="(\/_next\/static\/[^"]+?\.css[^"]*)"/g)].map((m) => m[1]).slice(0, 2);
  if (!css.length) warn("Could not find the stylesheet link on the home page");
  for (const c of css) { const { res } = await get(c); const t = res.headers.get("content-type") ?? ""; res.status === 200 && t.includes("text/css") ? ok(`Stylesheet loads (${t.split(";")[0]})`) : bad(`Stylesheet ${c} → HTTP ${res.status}, ${t}`, "Redeploy; if it persists, Vercel → Settings → clear the build cache and redeploy."); }
  const logos = [...new Set([...homeHtml.matchAll(/src="(\/partners\/[^"]+)"/g)].map((m) => m[1]))];
  let brokenLogos = 0; for (const l of logos) { const { res } = await get(l); if (res.status !== 200 || !(res.headers.get("content-type") ?? "").startsWith("image/")) { brokenLogos++; bad(`Logo ${l} → HTTP ${res.status}`); } }
  if (logos.length && !brokenLogos) ok(`${logos.length} partner logos load`);

  if (email) {
    console.log(`\n4. Full system check on the live server (signing in as ${email})`);
    const password = await askHidden("   Password: ");
    const login = await get("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ email, password }) });
    if (login.res.status !== 200) { const m = await login.res.json().catch(() => ({})); bad(`Sign-in failed (HTTP ${login.res.status}): ${m.message ?? ""}`, login.res.status === 401 ? "Wrong email/password, or the account is not on the LIVE site. Run npm run check:system to see the accounts." : undefined); }
    else {
      const cookie = login.res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
      const { res } = await get("/api/admin/system-check", { method: "POST", headers: { Origin: base, cookie } });
      if (!res.ok) bad(`System check could not run (HTTP ${res.status})${res.status === 404 ? ": the live code is too old" : ""}`);
      else { const r = await res.json(); for (const s of r.steps) { const line = `${s.label}: ${s.detail}`; s.status === "pass" ? ok(line) : s.status === "warn" ? warn(line, s.fix) : bad(line, s.fix); } }
      await get("/api/auth/logout", { method: "POST", headers: { Origin: base, cookie } }).catch(() => undefined);
    }
  } else console.log(`\n4. Tip: add  --email you@example.org  to also run the full system check on the live server.`);
  finish();
}
function finish() {
  console.log(failed ? `\n✘ ${failed} problem(s) found${warned ? `, ${warned} warning(s)` : ""}. Fix the ✘ items above.` : warned ? `\n✔ Working, with ${warned} warning(s) (!).` : "\n✔ The live site is up to date and working.");
  console.log("Final proof: submit one real test application from your phone, check the row appears in the sheet, then delete that row.\n");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error("\n✘ The check itself crashed:", e?.message ?? e); process.exit(1); });
