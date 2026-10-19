import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { cancelCampaign, createCampaign, listCampaigns, preview, sendBatch, sendTest } from "@/lib/services/emailCampaignService";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const send = (r: { ok: boolean; status: number; data?: unknown; body?: unknown }) => NextResponse.json(r.ok ? r.data : r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const auth = await requireApiPermission("email:send");
  if ("error" in auth) return auth.error;
  try { return NextResponse.json(await listCampaigns(), { headers: { "Cache-Control": "no-store" } }); } catch (e) { return serverError(e); }
}

/** { action: "preview" | "test" | "create", subject, heading?, body, audience }  or  { action: "send" | "cancel", campaignId } */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("email:send");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const b = ((await readJson(req, 250_000)) ?? {}) as Record<string, unknown>;
    const id = typeof b.campaignId === "string" ? b.campaignId.slice(0, 40) : "";
    switch (b.action) {
      case "preview": return send(await preview(b));
      case "test": return send(await sendTest(b, auth.user.email));
      case "create": return send(await createCampaign(b, auth.user.email));
      case "send": return send(await sendBatch(id, auth.user.email));
      case "cancel": return send(await cancelCampaign(id, auth.user.email));
      default: return NextResponse.json({ message: "Unknown action." }, { status: 422 });
    }
  } catch (e) { return serverError(e); }
}
