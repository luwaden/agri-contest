import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { can } from "@/lib/auth/permissions";
import { panelMayOpenFile } from "@/lib/services/reviewService";
import { cloudinaryConfigured, parseCloudinaryUrl, signedDownloadUrl } from "@/lib/cloudinary/client";
import { getRepository } from "@/lib/repository";

export const dynamic = "force-dynamic";

/** Opens a stored document for staff, or for a judge/reviewer if the application is assigned to them. Private Cloudinary files are served through a short-lived signed link. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Please sign in to continue." }, { status: 401 });
  const url = req.nextUrl.searchParams.get("url") ?? "";
  // Staff who see every application, or a judge/reviewer for a file of an application assigned to them. Nobody else.
  if (!can(user.role, "applications:view") && !(can(user.role, "scores:submit") && (await panelMayOpenFile(user, url))))
    return NextResponse.json({ message: "You do not have permission to open that file." }, { status: 403 });
  const auth = { user };
  const parsed = parseCloudinaryUrl(url);
  if (!parsed || !cloudinaryConfigured() || parsed.cloudName !== process.env.CLOUDINARY_CLOUD_NAME) return NextResponse.json({ message: "That file is not stored with the programme." }, { status: 404 });
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor: auth.user.email, action: "FILE_VIEWED", detail: parsed.publicId.slice(0, 160) }).catch(() => undefined);
  const target = parsed.type === "upload" ? url : signedDownloadUrl(parsed);
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
}
