import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { sameOrigin, serverError } from "@/lib/http";
import { attachmentLimitBytes, saveAttachment } from "@/lib/email/attachments";
import { getRepository } from "@/lib/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** multipart/form-data { file } → { id, name, bytes, mime }. Administrators only (same permission as sending). */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("email:send");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    if (Number(req.headers.get("content-length") || 0) > attachmentLimitBytes() + 64 * 1024)
      return NextResponse.json({ message: `That file is too large. Attachments can be up to ${Math.round(attachmentLimitBytes() / 1048576)} MB in total.` }, { status: 413 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ message: "Please choose a file to attach." }, { status: 400 });
    const r = await saveAttachment(new Uint8Array(await file.arrayBuffer()), file.name);
    if (!r.ok) return NextResponse.json({ message: r.message }, { status: 422 });
    await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor: auth.user.email, action: "EMAIL_ATTACHMENT_ADDED", detail: `${r.data.id} | ${r.data.name} | ${r.data.bytes} bytes`.slice(0, 300) }).catch(() => {});
    return NextResponse.json(r.data, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}
