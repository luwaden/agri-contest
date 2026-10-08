import { NextResponse, type NextRequest } from "next/server";
import { sheetsConfigured } from "@/lib/google-sheets/client";
import { cloudinaryConfigured } from "@/lib/cloudinary/client";
import { appsScriptConfigured } from "@/lib/google-sheets/appsScript";
import { getAIProvider } from "@/lib/ai";
import { getRepository } from "@/lib/repository";
import { kv, redisConfigured } from "@/lib/kv";
import { classifyError, clientIp, rateLimit } from "@/lib/http";
import { APP_VERSION, FEATURES, commit } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * GET /api/health                 which integrations are configured (booleans only, never values).
 * GET /api/health?check=store     ALSO reads the data store and reports exactly what is wrong, e.g.
 *                                 {"ok":false,"code":"SHEET_NOT_SHARED"}. Safe to open in a browser.
 * If HEALTH_CHECK_TOKEN is set, ?check=store additionally requires &token=<that value>.
 */
export async function GET(req: NextRequest) {
  const ai = getAIProvider();
  const backend = process.env.DATA_BACKEND || (sheetsConfigured() ? "sheets" : appsScriptConfigured() ? "appsscript" : "local");
  const base = {
    status: "ok", time: new Date().toISOString(), version: APP_VERSION, commit: commit(), features: FEATURES,
    integrations: {
      dataStore: backend, sheets: sheetsConfigured(), appsScript: appsScriptConfigured(), cloudinary: cloudinaryConfigured(), redis: redisConfigured(),
      assistant: process.env.NEXT_PUBLIC_ASSISTANT_PUBLIC === "true" ? "everyone" : "staff only",
      googleScriptMirror: Boolean(process.env.GOOGLE_SCRIPT_URL), ai: ai ? (ai.configured() ? ai.name : `${ai.name} (missing key/model)`) : "off",
      production: process.env.NODE_ENV === "production",
    },
  };
  if (req.nextUrl.searchParams.get("check") !== "store") return NextResponse.json(base, { headers: { "Cache-Control": "no-store" } });

  const need = process.env.HEALTH_CHECK_TOKEN;
  if (need && req.nextUrl.searchParams.get("token") !== need) return NextResponse.json({ ...base, store: { ok: false, code: "TOKEN_REQUIRED" } }, { status: 401 });
  const rl = await rateLimit(`health:${clientIp(req)}`, 12, 60_000);
  if (!rl.ok) return NextResponse.json({ message: "Too many checks. Wait a minute." }, { status: 429 });

  let store: Record<string, unknown>;
  try { store = { ...(await getRepository().diagnose()) }; }
  catch (e) { store = { ok: false, kind: backend, code: classifyError(e) }; }
  const redis = await kv.ping();
  const hints: Record<string, string> = {
    STORE_NOT_CONFIGURED: "On Vercel set DATA_BACKEND=sheets plus GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY, then redeploy.",
    GOOGLE_KEY: "GOOGLE_PRIVATE_KEY is damaged. Paste the private_key value from the JSON as ONE line (no quotes on Vercel), then redeploy.",
    SHEET_NOT_SHARED: "Share the Google Sheet with the service-account email as Editor.",
    SHEET_NOT_FOUND: "GOOGLE_SHEET_ID is wrong.",
    SHEET_TAB_MISSING: "A tab is missing. Run npm run setup:sheets once against this sheet.",
    SHEET_QUOTA: "Google Sheets rate limit reached. Add Upstash Redis (docs/UPSTASH.md) and retry in a minute.",
    NETWORK: "The server could not reach Google. Retry; if it persists check Google's status page.",
  };
  const code = (store.code as string | undefined);
  return NextResponse.json({ ...base, store: { ...store, hint: code ? hints[code] : undefined }, redisStatus: redis }, { status: store.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
