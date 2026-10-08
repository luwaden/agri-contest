import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit, sameOrigin, serverError, tooMany } from "@/lib/http";
import { getWindowStatus } from "@/lib/window";
import { MAX_BYTES } from "@/lib/cloudinary/validate";
import { storeUpload } from "@/lib/services/uploadService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public upload endpoint for applicants (stage documents) and mentors (CV).
 * multipart/form-data: file, scope ("applicant" | "mentor"), owner (random upload-session id), kind.
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
    const rl = await rateLimit(`upload:${clientIp(req)}`, 25, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > MAX_BYTES() + 64 * 1024) return NextResponse.json({ message: "That file is too large." }, { status: 413 });

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const scope = String(form?.get("scope") ?? ""), owner = String(form?.get("owner") ?? ""), kind = String(form?.get("kind") ?? "");
    if (!(file instanceof File) || (scope !== "applicant" && scope !== "mentor")) return NextResponse.json({ message: "Please choose a file to upload." }, { status: 400 });
    if (scope === "applicant" && getWindowStatus() !== "OPEN") return NextResponse.json({ message: "Applications are not open, so files cannot be uploaded." }, { status: 403 });

    const r = await storeUpload({ buffer: new Uint8Array(await file.arrayBuffer()), filename: file.name, scope, ownerId: owner, kind });
    return r.ok ? NextResponse.json(r.data, { status: r.status }) : NextResponse.json(r.body, { status: r.status });
  } catch (e) { return serverError(e); }
}
