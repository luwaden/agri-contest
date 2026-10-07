import { NextResponse } from "next/server";
import { sheetsConfigured } from "@/lib/google-sheets/client";
import { cloudinaryConfigured } from "@/lib/cloudinary/client";
import { appsScriptConfigured } from "@/lib/google-sheets/appsScript";
import { getAIProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** For Render's health check and uptime monitors. Reports whether integrations are configured, never their values. */
export function GET() {
  const ai = getAIProvider();
  return NextResponse.json({
    status: "ok", time: new Date().toISOString(),
    integrations: { dataStore: process.env.DATA_BACKEND || (sheetsConfigured() ? "sheets" : appsScriptConfigured() ? "appsscript" : "local"), sheets: sheetsConfigured(), appsScript: appsScriptConfigured(), cloudinary: cloudinaryConfigured(), googleScriptMirror: Boolean(process.env.GOOGLE_SCRIPT_URL), ai: ai ? (ai.configured() ? ai.name : `${ai.name} (missing key/model)`) : "off" },
  }, { headers: { "Cache-Control": "no-store" } });
}
