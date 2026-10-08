import { NextResponse, type NextRequest } from "next/server";
import { badRequest, clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { passwordResetAvailable } from "@/lib/auth/passwords";
import { completePasswordLink } from "@/lib/auth/users";
import { getRepository } from "@/lib/repository";

/** The person sets a new password with their one-time link. */
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
    if (!passwordResetAvailable()) return NextResponse.json({ message: "Password reset is not switched on. Contact an administrator." }, { status: 503 });
    const rl = await rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const body = (await readJson(req, 2_000)) as { token?: string; password?: string } | null;
    if (!body?.token || !body?.password) return badRequest("Please enter your new password.");
    const r = await completePasswordLink(body.token, body.password);
    if (!r.ok) return NextResponse.json({ message: r.message }, { status: 400 });
    await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor: r.email, action: r.purpose === "invite" ? "PASSWORD_SET" : "PASSWORD_RESET", detail: r.purpose === "invite" ? "first password via invite link" : "via one-time link" }).catch(() => undefined);
    return NextResponse.json({ ok: true, redirect: "/admin/login" });
  } catch (e) { return serverError(e); }
}
