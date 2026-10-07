import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/lib/auth/users";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/permissions";
import { badRequest, clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
    const body = (await readJson(req, 2_000)) as { email?: string; password?: string } | null;
    if (!body?.email || !body?.password) return badRequest("Please enter your email and password.");
    const rl = rateLimit(`login:${clientIp(req)}:${body.email.toLowerCase()}`, 5, 15 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const user = await authenticate(body.email, body.password);
    if (!user) return NextResponse.json({ message: "That email and password do not match. Please try again." }, { status: 401 });
    const res = NextResponse.json({ redirect: homeFor(user.role), name: user.name });
    res.cookies.set(SESSION_COOKIE, await createSessionToken(user), sessionCookieOptions);
    return res;
  } catch (e) { return serverError(e); }
}
