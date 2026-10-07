import type { AIProvider } from "./types";
import { OpenAIProvider } from "./providers/openai";
import { ClaudeProvider } from "./providers/claude";

/** AI_PROVIDER = "openai" | "claude" | "none" (default). Switching provider is a configuration change only. */
export function getAIProvider(): AIProvider | null {
  switch ((process.env.AI_PROVIDER || "none").toLowerCase()) {
    case "openai": return new OpenAIProvider();
    case "claude": case "anthropic": return new ClaudeProvider();
    default: return null;
  }
}
export type { AIProvider } from "./types";
