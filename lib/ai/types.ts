export interface AIMessage { role: "user" | "assistant"; content: string }
export interface AICompletion { text: string; model: string; provider: string }

/**
 * The ONLY interface the application knows about. Providers receive text (a question plus a minimal, sanitised
 * context built by the backend). They never receive database credentials, query access or raw applicant tables.
 */
export interface AIProvider {
  readonly name: "openai" | "claude";
  configured(): boolean;
  complete(input: { system: string; messages: AIMessage[]; maxTokens?: number }): Promise<AICompletion>;
}
