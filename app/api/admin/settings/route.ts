import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { readJson, sameOrigin, serverError } from "@/lib/http";
import { loadFeatures, setFeature } from "@/lib/features";
import { isFeatureKey } from "@/config/features";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** The feature switches as they are now. Administrators only. */
export async function GET() {
  const auth = await requireApiPermission("config:manage");
  if ("error" in auth) return auth.error;
  try { return NextResponse.json(await loadFeatures(true), { headers: noStore }); } catch (e) { return serverError(e); }
}

/** { key, on } turns one switch on or off. Administrators only; recorded in the Configuration tab and the activity log. */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("config:manage");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    const b = ((await readJson(req, 1_000)) ?? {}) as { key?: unknown; on?: unknown };
    if (!isFeatureKey(b.key) || typeof b.on !== "boolean") return NextResponse.json({ message: "Unknown setting." }, { status: 422 });
    return NextResponse.json(await setFeature(b.key, b.on, auth.user.email), { headers: noStore });
  } catch (e) { return serverError(e); }
}
