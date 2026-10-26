import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { can } from "@/lib/auth/permissions";
import { panelMayOpenFile } from "@/lib/services/reviewService";
import { cloudinaryConfigured, parseCloudinaryUrl, signedDownloadUrl } from "@/lib/cloudinary/client";
import { getRepository } from "@/lib/repository";
import { REFERENCE_PATTERN } from "@/lib/reference";
import { isStoredRef, readLocal } from "@/lib/files/localStore";
import { ALLOWED, type AllowedExt } from "@/lib/cloudinary/validate";

export const dynamic = "force-dynamic";

/** Opens a stored document for staff, or for a judge/reviewer if the application is assigned to them. Private Cloudinary files are served through a short-lived signed link. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Please sign in to continue." }, { status: 401 });
  const url = req.nextUrl.searchParams.get("url") ?? "";
  // Optional: the application the file belongs to, so the audit log says whose file was opened.
  const forApp = req.nextUrl.searchParams.get("for") ?? "";
  const appId = REFERENCE_PATTERN.test(forApp) ? forApp : "-";
  if (url.startsWith("stored:")) return openStored(url, user.email, can(user.role, "applications:view"), appId);
  // Staff who see every application, or a judge/reviewer for a file of an application assigned to them. Nobody else.
  if (!can(user.role, "applications:view") && !(can(user.role, "scores:submit") && (await panelMayOpenFile(user, url))))
    return NextResponse.json({ message: "You do not have permission to open that file." }, { status: 403 });
  const auth = { user };
  const parsed = parseCloudinaryUrl(url);
  if (!parsed || !cloudinaryConfigured() || parsed.cloudName !== process.env.CLOUDINARY_CLOUD_NAME) return NextResponse.json({ message: "That file is not stored with the programme." }, { status: 404 });
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: appId, actor: auth.user.email, action: "FILE_VIEWED", detail: parsed.publicId.slice(0, 160) }).catch(() => undefined);
  const target = parsed.type === "upload" ? url : signedDownloadUrl(parsed);
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
}

/** A file kept on this server's disk (Level 2 uploads when Cloudinary is not used). Staff who see all applications only. */
async function openStored(ref: string, actor: string, allowed: boolean, applicationId = "-") {
  if (!allowed) return NextResponse.json({ message: "You do not have permission to open that file." }, { status: 403 });
  const data = isStoredRef(ref) && !ref.startsWith("stored:email-attachments/") ? await readLocal(ref) : null;
  if (!data) return NextResponse.json({ message: "That file is not on this server. It may have been uploaded to another copy of the site." }, { status: 404 });
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId, actor, action: "FILE_VIEWED", detail: ref.slice(0, 160) }).catch(() => undefined);
  const ext = (ref.split(".").pop() ?? "").toLowerCase() as AllowedExt;
  const name = ref.split("/").pop()!;
  return new NextResponse(new Uint8Array(data), { headers: {
    "Content-Type": ALLOWED[ext]?.mime ?? "application/octet-stream",
    "Content-Disposition": `${ext === "pdf" || ALLOWED[ext]?.mime.startsWith("image/") ? "inline" : "attachment"}; filename="${name}"`,
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Cache-Control": "private, no-store",
  } });
}
