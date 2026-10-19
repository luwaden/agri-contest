import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIProvider } from "../lib/ai/providers/openai";

Object.assign(process.env, { OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "test-reasoner" });
const calls: Array<Record<string, unknown>> = []; let refuseEffort = false;
globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
  const b = JSON.parse(init!.body!); calls.push(b);
  if (refuseEffort && "reasoning_effort" in b) return new Response(JSON.stringify({ error: { message: "Unsupported value: 'reasoning_effort' does not support 'none' with this model.", param: "reasoning_effort" } }), { status: 400 });
  return new Response(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }), { status: 200 });
}) as typeof fetch;

test("OPENAI_REASONING_EFFORT is sent; a model that refuses it is asked again without it; AI_MAX_OUTPUT_TOKENS raises the budget", async () => {
  const ai = new OpenAIProvider();
  process.env.OPENAI_REASONING_EFFORT = "low"; process.env.AI_MAX_OUTPUT_TOKENS = "8000";
  assert.equal((await ai.complete({ system: "s", messages: [{ role: "user", content: "q" }], maxTokens: 4000 })).text, "ok");
  assert.equal(calls[0].reasoning_effort, "low"); assert.equal(calls[0].max_completion_tokens, 8000);
  calls.length = 0; refuseEffort = true; process.env.OPENAI_REASONING_EFFORT = "none";
  const warn = console.warn; console.warn = () => {};
  try { assert.equal((await ai.complete({ system: "s", messages: [{ role: "user", content: "q" }] })).text, "ok"); } finally { console.warn = warn; }
  assert.equal(calls.length, 2); assert.ok(!("reasoning_effort" in calls[1]));
  calls.length = 0; process.env.OPENAI_REASONING_EFFORT = "nonsense"; delete process.env.AI_MAX_OUTPUT_TOKENS;
  await ai.complete({ system: "s", messages: [{ role: "user", content: "q" }], maxTokens: 700 });
  assert.ok(!("reasoning_effort" in calls[0]), "unknown values are not sent"); assert.equal(calls[0].max_completion_tokens, 700);
});
