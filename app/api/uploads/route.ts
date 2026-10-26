import { NextResponse, type NextRequest } from "next/server";
import { clientIp, rateLimit, sameOrigin, serverError, tooMany } from "@/lib/http";
import { getWindowStatus } from "@/lib/window";
import { MAX_BYTES } from "@/lib/cloudinary/validate";
import { storeUpload } from "@/lib/services/uploadService";
import { level2Pass } from "@/lib/services/level2Service";
import { featureOff, features } from "@/lib/features";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public upload endpoint for applicants (stage documents) and mentors (CV).
 * multipart/form-data: file, scope ("applicant" | "mentor"), owner (random upload-session id), kind.
 */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
    // Generous per address (mobile networks put many people behind one IP); Level 2 is also limited per applicant below.
    const rl = await rateLimit(`upload:${clientIp(req)}`, 60, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > MAX_BYTES() + 64 * 1024) return NextResponse.json({ message: "That file is too large." }, { status: 413 });

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const scope = String(form?.get("scope") ?? ""), kind = String(form?.get("kind") ?? "");
    let owner = String(form?.get("owner") ?? "");
    if (!(file instanceof File) || (scope !== "applicant" && scope !== "mentor" && scope !== "level2")) return NextResponse.json({ message: "Please choose a file to upload." }, { status: 400 });
    const on = await features();   // switches in Admin → Settings
    if (scope === "level2" && !on.level2Form) return featureOff("level2Form");
    if (scope === "level2" && !on.level2Uploads) return featureOff("level2Uploads");
    if (scope === "mentor" && !on.mentorForm) return featureOff("mentorForm");
    if (scope === "level2") {   // only a person holding a valid Level 2 pass; files go to that Level 1 code's folder
      const pass = level2Pass(form?.get("pass"));
      if (!pass) return NextResponse.json({ message: "Your session has expired. Please start again with your Level 1 code and email." }, { status: 401 });
      owner = pass.code;
      const per = await rateLimit(`upload:l2:${pass.code}`, 30, 10 * 60_000);
      if (!per.ok) return tooMany(per.retryAfter);
    }
    if (scope === "applicant" && getWindowStatus() !== "OPEN") return NextResponse.json({ message: "Applications are not open, so files cannot be uploaded." }, { status: 403 });

    const r = await storeUpload({ buffer: new Uint8Array(await file.arrayBuffer()), filename: file.name, scope, ownerId: owner, kind });
    return r.ok ? NextResponse.json(r.data, { status: r.status }) : NextResponse.json(r.body, { status: r.status });
  } catch (e) { return serverError(e); }
}
