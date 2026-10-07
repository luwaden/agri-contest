import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { cloudinaryConfigured, parseCloudinaryUrl, signedDownloadUrl } from "@/lib/cloudinary/client";
import { getRepository } from "@/lib/repository";

export const dynamic = "force-dynamic";

/** Opens a stored document for authorised staff. Private Cloudinary files are served through a short-lived signed link. */
export async function GET(req: NextRequest) {
  const auth = await requireApiPermission("applications:view");
  if ("error" in auth) return auth.error;
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const parsed = parseCloudinaryUrl(url);
  if (!parsed || !cloudinaryConfigured() || parsed.cloudName !== process.env.CLOUDINARY_CLOUD_NAME) return NextResponse.json({ message: "That file is not stored with the programme." }, { status: 404 });
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor: auth.user.email, action: "FILE_VIEWED", detail: parsed.publicId.slice(0, 160) }).catch(() => undefined);
  const target = parsed.type === "upload" ? url : signedDownloadUrl(parsed);
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
}
