import type { AICompletion, AIMessage, AIProvider } from "../types";

/** Anthropic Claude provider. Inactive until ANTHROPIC_API_KEY and ANTHROPIC_MODEL are set. */
export class ClaudeProvider implements AIProvider {
  readonly name = "claude" as const;
  configured() { return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL); }
  async complete({ system, messages, maxTokens = 700 }: { system: string; messages: AIMessage[]; maxTokens?: number }): Promise<AICompletion> {
    const model = process.env.ANTHROPIC_MODEL!;
    const res = await fetch(`${process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com"}/v1/messages`, {
      method: "POST", signal: AbortSignal.timeout(40_000),
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Claude error ${res.status}: ${body?.error?.message ?? "no detail"}`);
    const text = (body.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
    return { text, model, provider: this.name };
  }
}
