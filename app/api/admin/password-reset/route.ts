import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { badRequest, readJson, sameOrigin, serverError } from "@/lib/http";
import { listStaff } from "@/lib/auth/users";
import { createResetToken, passwordResetAvailable } from "@/lib/auth/passwords";
import { getRepository } from "@/lib/repository";

/** Administrator creates a one-time reset link for a staff member. The link is shown to the admin to send privately. */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("users:manage");
  if ("error" in auth) return auth.error;
  if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
  try {
    if (!passwordResetAvailable()) return NextResponse.json({ message: "Password resets need Redis (Upstash). Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN and redeploy." }, { status: 503 });
    const body = (await readJson(req, 1_000)) as { email?: string } | null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    const person = (await listStaff()).find((u) => u.email === email);
    if (!person) return badRequest("That email is not a staff account.");
    if (person.status === "deactivated") return badRequest("Reactivate this account first.");
    const { token, expiresAt, purpose } = await createResetToken(email, person.status === "invited" ? "invite" : "reset");
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
    await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor: auth.user.email, action: "RESET_LINK_CREATED", detail: `for ${email}` }).catch(() => undefined);
    return NextResponse.json({ link: `${origin}/reset-password?token=${token}`, expiresAt, purpose, name: person.name }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return serverError(e); }
}
