import type { AICompletion, AIMessage, AIProvider } from "../types";

/** OpenAI chat-completions provider. Inactive until OPENAI_API_KEY and OPENAI_MODEL are set. */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  configured() { return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL); }
  async complete({ system, messages, maxTokens = 700 }: { system: string; messages: AIMessage[]; maxTokens?: number }): Promise<AICompletion> {
    const model = process.env.OPENAI_MODEL!;
    const res = await fetch(`${process.env.OPENAI_API_BASE || "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST", signal: AbortSignal.timeout(40_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, max_completion_tokens: maxTokens, messages: [{ role: "system", content: system }, ...messages] }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${body?.error?.message ?? "no detail"}`);
    return { text: String(body.choices?.[0]?.message?.content ?? "").trim(), model, provider: this.name };
  }
}
