import { getRepository } from "@/lib/repository";
import { kv, redisConfigured } from "@/lib/kv";
import { sheetsConfigured } from "@/lib/google-sheets/client";
import { appsScriptConfigured } from "@/lib/google-sheets/appsScript";
import { APPLICATION_COLUMNS } from "@/lib/google-sheets/schema";
import { mappingRoundTrip } from "@/lib/selftest/mapping";
import { classifyError } from "@/lib/http";
import { windowSummary } from "@/lib/window";
import { getAIProvider } from "@/lib/ai";
import { APP_VERSION, commit } from "@/lib/version";
import { hashLooksValid, loadStaff } from "@/lib/auth/users";
import type { StoreDiagnosis } from "@/lib/repository/types";

export interface CheckStep { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string; fix?: string; ms: number }
const FIX: Record<string, string> = {
  STORE_NOT_CONFIGURED: "Set DATA_BACKEND=sheets and the three GOOGLE_* settings on Vercel, then redeploy.",
  GOOGLE_KEY: "Re-paste GOOGLE_PRIVATE_KEY as one line (no quotes on Vercel), then redeploy.",
  SHEET_NOT_SHARED: "Share the sheet with the service-account email as Editor.",
  SHEET_NOT_FOUND: "GOOGLE_SHEET_ID is wrong.",
  SHEET_TAB_MISSING: "Run npm run setup:sheets once against this sheet.",
  SHEET_QUOTA: "Google's read limit was hit. Wait a minute; make sure Redis is configured.",
  NETWORK: "Could not reach the service. Retry in a minute.",
};

async function step(id: string, label: string, fn: () => Promise<Omit<CheckStep, "id" | "label" | "ms">>): Promise<CheckStep> {
  const t0 = Date.now();
  try { return { id, label, ...(await fn()), ms: Date.now() - t0 }; }
  catch (e) { const code = classifyError(e); return { id, label, status: "fail", detail: `${code}: ${(e as Error).message?.slice(0, 160) ?? "error"}`, fix: FIX[code], ms: Date.now() - t0 }; }
}

/**
 * End-to-end check of everything a submission needs, run on the LIVE server.
 * Writes one harmless row to the "Application Events" tab (an audit entry: SYSTEM_CHECK) and reads it back.
 * Never writes to the Applications tab, so no fake application appears in your data.
 */
export async function runSystemCheck(actor: string): Promise<{ ok: boolean; version: string; commit: string; steps: CheckStep[] }> {
  const steps: CheckStep[] = [];
  const backend = process.env.DATA_BACKEND || (sheetsConfigured() ? "sheets" : appsScriptConfigured() ? "appsscript" : "local");

  steps.push(await step("settings", "Settings present", async () => {
    const missing = [!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 ? "SESSION_SECRET (32+ chars)" : "",
      backend === "sheets" && !sheetsConfigured() ? "GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY" : "",
      backend === "appsscript" && !appsScriptConfigured() ? "APPS_SCRIPT_URL / APPS_SCRIPT_SECRET" : ""].filter(Boolean);
    if (backend === "local" && process.env.NODE_ENV === "production") return { status: "fail", detail: "No data store is configured on this live server.", fix: FIX.STORE_NOT_CONFIGURED };
    return missing.length ? { status: "fail", detail: `Missing: ${missing.join(", ")}`, fix: "Add them in Vercel → Settings → Environment Variables, then redeploy." } : { status: "pass", detail: `Data store: ${backend}` };
  }));

  steps.push(await step("redis", "Redis (Upstash)", async () => {
    if (!redisConfigured()) return { status: "warn", detail: "Not configured. The site works, but rate limits are per-server, drafts use the sheet, and password resets are off.", fix: "Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, then redeploy (docs/UPSTASH.md)." };
    const k = `selftest:${Date.now()}`;
    const ping = await kv.ping(); if (ping !== "ok") return { status: "fail", detail: `Could not reach Redis: ${ping}`, fix: "Check the two UPSTASH_* values (copy them again from the REST API section)." };
    await kv.set(k, "ok", { ex: 60 }); const v = await kv.get(k); await kv.del(k);
    return v === "ok" ? { status: "pass", detail: "Wrote, read and deleted a test key." } : { status: "fail", detail: "Write/read mismatch." };
  }));

  let d: StoreDiagnosis | null = null;
  steps.push(await step("sheet", "Google Sheet reachable, tabs present", async () => {
    d = await getRepository().diagnose();
    if (d.code) return { status: "fail", detail: `${d.code}. Tabs: ${Object.entries(d.tabs).map(([t, st]) => `${t} ${st}`).join(", ")}`, fix: FIX[d.code] };
    const missing = Object.entries(d.tabs).filter(([, st]) => st !== "ok").map(([t]) => t);
    return missing.length ? { status: "fail", detail: `Missing tabs: ${missing.join(", ")}`, fix: FIX.SHEET_TAB_MISSING } : { status: "pass", detail: `Connected (${d.kind}). Tabs: ${Object.keys(d.tabs).join(", ")}.` };
  }));

  steps.push(await step("header", "Column titles (row 1) of every tab", async () => {
    const diag = d as StoreDiagnosis | null;
    if (!diag || diag.code) return { status: "warn", detail: "Could not check: the sheet is not reachable (fix the item above first)." };
    if (diag.headerOk === null) return { status: "pass", detail: "Not applicable for this data store." };
    const issues = Object.entries(diag.headerIssues ?? {}).filter(([, v]) => v);
    if (!diag.headerOk) return { status: "fail", detail: `Applications: ${diag.headerProblems?.join("; ") || "row 1 does not match"}`, fix: "Run npm run setup:sheets (it only adds missing titles). Never reorder columns." };
    if (issues.length) return { status: "warn", detail: issues.map(([t, v]) => `${t}: ${v}`).join(" | "), fix: "Run npm run setup:sheets on your computer. Submissions still work meanwhile." };
    return { status: "pass", detail: `All tabs match the app (Applications has ${APPLICATION_COLUMNS.length} columns).` };
  }));

  steps.push(await step("staff", "Staff sign-in accounts", async () => {
    const { accounts, ok, envError, damaged } = await loadStaff({ fresh: true });
    if (envError) return { status: "fail", detail: envError, fix: "Fix ADMIN_USERS_JSON (or remove it and keep accounts in the Admin Users tab), then redeploy." };
    const fromSheet = accounts.filter((a) => a.source === "sheet").length, fromEnv = accounts.length - fromSheet;
    const canAdmin = accounts.filter((a) => a.role === "ADMIN" && a.active && hashLooksValid(a.passwordHash));
    const invited = accounts.filter((a) => a.active && !a.passwordHash).map((a) => a.email);
    const counts = `${accounts.length} account(s): ${fromSheet} in the Admin Users tab, ${fromEnv} in ADMIN_USERS_JSON.`;
    if (damaged.length) return { status: "fail", detail: `${counts} Damaged password for: ${damaged.join(", ")} (a .env file probably removed the $ signs).`, fix: "Run npm run make-user again for each of them, or send them a reset link from Admin → Staff." };
    if (!canAdmin.length) return { status: "fail", detail: `${counts} No active administrator can sign in.`, fix: 'Run: npm run make-user -- "you@example.org" "Your Name" ADMIN "a-long-password"' };
    if (!ok) return { status: "warn", detail: `${counts} The Admin Users tab could not be read just now, so only ADMIN_USERS_JSON accounts can sign in.` };
    return { status: invited.length ? "warn" : "pass", detail: `${counts} ${canAdmin.length} administrator(s) can sign in.${invited.length ? ` Waiting to set a password: ${invited.join(", ")}.` : ""}`, ...(invited.length ? { fix: "Send them their invite link (Admin → Staff → New invite link)." } : {}) };
  }));

  steps.push(await step("write", "Write to the sheet and read it back", async () => {
    const marker = `SELFTEST-${Date.now().toString(36).toUpperCase()}`;
    const repo = getRepository();
    await repo.logEvent({ at: new Date().toISOString(), applicationId: marker, actor, action: "SYSTEM_CHECK", detail: `version ${APP_VERSION}` });
    const found = (await repo.getEvents(50)).some((e) => e.applicationId === marker);
    return found ? { status: "pass", detail: `Wrote ${marker} to "Application Events" and read it back.` } : { status: "fail", detail: "The row was written but could not be read back.", fix: "Check the sheet is not filtered/protected and the tab name is exactly 'Application Events'." };
  }));

  steps.push(await step("mapping", "A full application fits the sheet", async () => { const m = mappingRoundTrip(); return { status: m.ok ? "pass" : "fail", detail: m.detail }; }));

  steps.push(await step("window", "Application window", async () => {
    const w = windowSummary(); return { status: w.status === "OPEN" ? "pass" : "warn", detail: `${w.range} Status now: ${w.status.replace("_", " ").toLowerCase()}.` };
  }));

  steps.push(await step("ai", "AI assistant", async () => {
    const p = getAIProvider(); const pub = process.env.NEXT_PUBLIC_ASSISTANT_PUBLIC === "true";
    return { status: "pass", detail: `${p ? (p.configured() ? `${p.name} switched on` : `${p.name} selected but key/model missing (quick answers only)`) : "off (quick answers only)"}; visible to ${pub ? "everyone" : "signed-in staff only"}.` };
  }));

  return { ok: steps.every((s) => s.status !== "fail"), version: APP_VERSION, commit: commit(), steps };
}
