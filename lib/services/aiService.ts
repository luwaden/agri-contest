import { getAIProvider } from "@/lib/ai";
import { buildAIContext, buildPrompt } from "@/lib/ai/context";
import { getAllApplications } from "./analyticsService";
import { getRepository } from "@/lib/repository";
import type { ApplicationFilters } from "@/lib/analytics/filters";
import type { ServiceResult } from "./applicationService";

export interface AIAnswer { answer: string; provider: string; model: string; shared: { aggregates: true; excerpts: number; applicantsConsidered: number } }

/**
 * DATABASE → services → context builder (aggregates only) → AIProvider → admin.
 * The provider is handed a string. It has no connection, credentials or query tool for the database.
 */
export async function askAI(question: string, filters: ApplicationFilters, actor: string): Promise<ServiceResult<AIAnswer>> {
  const q = question.trim();
  if (q.length < 3 || q.length > 500) return { ok: false, status: 400, body: { message: "Please ask a question between 3 and 500 characters." } };
  const provider = getAIProvider();
  if (!provider || !provider.configured())
    return { ok: false, status: 503, body: { code: "AI_NOT_CONFIGURED", message: "The AI assistant is not switched on yet. Set AI_PROVIDER and the provider's API key and model in the server environment." } };

  const ctx = buildAIContext(q, await getAllApplications(), filters);
  try {
    const out = await provider.complete({ ...buildPrompt(q, ctx), maxTokens: 700 });
    // Audit trail: who asked what, which provider, and how much data was shared (never the answer or the data).
    await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor, action: "AI_QUERY", detail: `${provider.name} | considered=${ctx.shared.applicantsConsidered} excerpts=${ctx.shared.excerpts} | ${q.slice(0, 160)}` }).catch(() => undefined);
    return { ok: true, status: 200, data: { answer: out.text, provider: out.provider, model: out.model, shared: ctx.shared } };
  } catch (e) {
    console.error("[ai]", (e as Error).message);
    return { ok: false, status: 502, body: { message: "The AI service did not respond. Please try again in a moment." } };
  }
}
