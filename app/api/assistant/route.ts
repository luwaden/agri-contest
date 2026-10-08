import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { badRequest, clientIp, rateLimit, readJson, sameOrigin, serverError, tooMany } from "@/lib/http";
import { askAssistant, type Turn } from "@/lib/services/assistantService";
import { SUGGESTIONS } from "@/config/knowledge";
import { getAIProvider } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** The assistant is for signed-in staff only, unless NEXT_PUBLIC_ASSISTANT_PUBLIC=true is set (then visitors get it too). */
const publicOn = () => process.env.NEXT_PUBLIC_ASSISTANT_PUBLIC === "true";

const audienceOf = (role?: string) => (role === "ADMIN" || role === "COORDINATOR" ? "admin" : role === "JUDGE" || role === "REVIEWER" ? "panel" : "public") as "public" | "panel" | "admin";

/** Who is asking and what to suggest. Works for visitors and signed-in staff. */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user && !publicOn()) return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
  const audience = audienceOf(user?.role);
  const ai = getAIProvider();
  return NextResponse.json({ enabled: true, audience, role: user?.role ?? null, suggestions: SUGGESTIONS[audience], ai: Boolean(ai?.configured()) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return NextResponse.json({ message: "This request was not allowed." }, { status: 403 });
    const user = await getCurrentUser().catch(() => null);
    if (!user && !publicOn()) return NextResponse.json({ message: "The assistant is available to programme staff only. Please sign in." }, { status: 401 });
    // Staff get a higher allowance, visitors are limited per network address.
    const rl = user ? await rateLimit(`assist:u:${user.email}`, 40, 10 * 60_000) : await rateLimit(`assist:ip:${clientIp(req)}`, 15, 10 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const body = (await readJson(req, 6_000)) as { question?: string; history?: Turn[] } | null;
    if (!body?.question || typeof body.question !== "string") return badRequest("Please type a question.");
    // Looking up a reference number is limited more tightly, so it cannot be used to guess references.
    if (/AGRA-\d{4}-/i.test(body.question) && !user) { const l = await rateLimit(`assist:ref:${clientIp(req)}`, 8, 10 * 60_000); if (!l.ok) return tooMany(l.retryAfter); }
    const r = await askAssistant({ question: body.question, history: Array.isArray(body.history) ? body.history : [], role: user?.role, actor: user?.email ?? "visitor" });
    return r.ok ? NextResponse.json(r.data, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json(r.body, { status: r.status });
  } catch (e) { return serverError(e); }
}
