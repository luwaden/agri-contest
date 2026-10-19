import type { AICompletion, AIMessage, AIProvider } from "../types";

/**
 * OpenAI chat-completions provider. Inactive until OPENAI_API_KEY and OPENAI_MODEL are set.
 *
 * OPENAI_REASONING_EFFORT (optional): none | minimal | low | medium | high. Reasoning models "think" before they answer,
 * and that thinking counts against the reply budget; less effort = faster, cheaper, and less risk of an empty reply.
 * Which values a model accepts depends on the model. If the model refuses the setting, the request is retried without it.
 * AI_MAX_OUTPUT_TOKENS (optional): raises the per-reply budget for every AI request in the app.
 */
const EFFORTS = ["none", "minimal", "low", "medium", "high"];

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  configured() { return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL); }
  async complete({ system, messages, maxTokens = 700 }: { system: string; messages: AIMessage[]; maxTokens?: number }): Promise<AICompletion> {
    const model = process.env.OPENAI_MODEL!;
    const budget = Math.max(maxTokens, Number(process.env.AI_MAX_OUTPUT_TOKENS) || 0);
    const effort = (process.env.OPENAI_REASONING_EFFORT || "").trim().toLowerCase();
    const send = (withEffort: boolean) => fetch(`${process.env.OPENAI_API_BASE || "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST", signal: AbortSignal.timeout(120_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, max_completion_tokens: budget, messages: [{ role: "system", content: system }, ...messages], ...(withEffort ? { reasoning_effort: effort } : {}) }),
    });
    const useEffort = EFFORTS.includes(effort);
    let res = await send(useEffort);
    let body = await res.json().catch(() => ({}));
    if (!res.ok && useEffort && res.status === 400 && /reasoning/i.test(String(body?.error?.message ?? body?.error?.param ?? ""))) {
      console.warn(`[ai] ${model} does not accept reasoning_effort="${effort}"; asking again without it. Change OPENAI_REASONING_EFFORT or remove it.`);
      res = await send(false); body = await res.json().catch(() => ({}));
    }
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${body?.error?.message ?? "no detail"}`);
    const text = String(body.choices?.[0]?.message?.content ?? "").trim();
    if (!text && body.choices?.[0]?.finish_reason === "length") console.warn(`[ai] ${model} used its whole reply budget (${budget} tokens) thinking and returned nothing. Set OPENAI_REASONING_EFFORT=low (or none/minimal), or raise AI_MAX_OUTPUT_TOKENS.`);
    return { text, model, provider: this.name };
  }
}
