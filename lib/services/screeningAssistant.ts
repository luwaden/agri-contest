import "server-only";
import { getAIProvider } from "@/lib/ai";
import { listSpecSchema, parseRequest, describeSpec, buildList, isFocal, type ListSpec } from "@/lib/screening/customList";
import { SCREENING } from "@/config/screening";
import { FOCAL_STATES, zoneOf } from "@/config/admin";
import { VALUE_CHAINS } from "@/config/programme";
import { isLiveReview } from "@/types/review";
import type { Application } from "@/types/application";
import { rankedData, moveReviews, sendPassedToJudges, toCsv, CSV_PERSON_COLUMNS, CSV_SCORE_COLUMNS, csvPersonCells, csvScoreCells } from "./screeningService";

/**
 * THE SCREENING ASSISTANT (admins and coordinators).
 * It turns a sentence into ONE of: a list (preview + CSV), an answer (counts), or a proposed action (preview +
 * the exact request the Confirm button sends). It never changes anything itself: actions go through the same
 * checked API as the buttons, and only when a person presses Confirm.
 * If AI_PROVIDER is set, the AI only translates the SENTENCE into list settings. It never receives applicant data.
 */
export type AssistantReply =
  | { kind: "list"; spec: ListSpec; description: string; source: "ai" | "rules"; understood: string[]; unclear: string[]; report: Awaited<ReturnType<typeof listPreview>> }
  | { kind: "answer"; text: string; lines: Array<[string, string]> }
  | { kind: "action"; text: string; preview: Record<string, unknown>; confirm: Record<string, unknown> }
  | { kind: "unclear"; text: string };

const EXAMPLES = [
  "Send the CSV of the best 1300, 60% from focal states, 40% from other states, at least 20% women",
  "How many women and PWD are in the batch?",
  "Move Reviewer 4's unfinished work to the other reviewers",
  "Send the passed applications to the judges, 3 judges each",
];
export const assistantExamples = () => EXAMPLES;

const pctOf = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

async function listPreview(spec: ListSpec) {
  const d = await rankedData();
  const r = buildList(d.ranked, d.applications, spec);
  return { counts: r.counts, scope: r.scope, lowestScore: r.lowestScore, notes: r.notes, eligible: d.ranked.length };
}

/** The CSV for a list spec (validated again here: the spec comes back from the browser). */
export async function customListCsv(rawSpec: unknown) {
  const spec = listSpecSchema.parse(rawSpec);
  const d = await rankedData();
  const r = buildList(d.ranked, d.applications, spec);
  const rows = r.rows.map((x) => { const a = d.apps.get(x.applicationId); return [x.position, x.overallRank, x.applicationId, a && isFocal(a) ? "focal" : "other", a?.inclusion.disability === "YES" ? "yes" : "no", x.placedBy, ...csvPersonCells(a), ...csvScoreCells(d.byId.get(x.applicationId))]; });
  return { rows: rows.length, filename: `list-${spec.size}-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: toCsv(["position", "overall_rank", "application_id", "location_group", "pwd", "placed_by", ...CSV_PERSON_COLUMNS, ...CSV_SCORE_COLUMNS], rows), description: describeSpec(spec) };
}

// ───────────── AI: sentence → settings only ─────────────
async function aiSpec(text: string): Promise<ListSpec | null> {
  const ai = getAIProvider(); if (!ai?.configured()) return null;
  const system = `You convert an administrator's request into JSON settings for a ranked applicant list. Reply with JSON only, no prose.
Schema: {"size": integer, "focalShare": number 0..1 or null, "otherShare": number 0..1 or null, "minWomenShare": number 0..1 or null, "minPwdShare": number 0..1 or null, "minRuralShare": number 0..1 or null, "minimumsWithinFirst": integer or null, "states": string[], "valueChains": string[]}
Focal states are ${FOCAL_STATES.join(", ")}. "Other states" means all the rest. Value chain codes: ${VALUE_CHAINS.map((v) => v.value).join(", ")}.
Shares are exact for focal/other and minimums for women/PWD/rural. "In the first N" sets minimumsWithinFirst. Use null for anything not asked. PWD only gets a share if a number is attached to PWD itself. Default size ${SCREENING.shortlistSize}.`;
  try {
    const out = await ai.complete({ system, messages: [{ role: "user", content: text.slice(0, 600) }], maxTokens: 300 });
    const json = JSON.parse(out.text.replace(/^```(json)?|```$/g, "").trim());
    const p = listSpecSchema.safeParse({ states: [], valueChains: [], ...json });
    return p.success ? p.data : null;
  } catch (e) { console.warn("[screening-assistant] AI could not read the request; using the rules:", String((e as Error)?.message ?? e).slice(0, 160)); return null; }
}

// ───────────── questions: counts over a set ─────────────
type SetName = "eligible" | "batch" | "passed" | "judges" | "top";
function whichSet(t: string): { set: SetName; n?: number } {
  if (/passed|150\b/.test(t)) return { set: "passed" };
  if (/judg|final/.test(t)) return { set: "judges" };
  if (/batch|500\b|with reviewers|reviewers have/.test(t)) return { set: "batch" };
  const top = /(?:top|best|first|shortlist(?:ed)?)\s*(\d[\d,]*)?/.exec(t);
  if (top) return { set: "top", n: top[1] ? Number(top[1].replace(/,/g, "")) : SCREENING.shortlistSize };
  return { set: "eligible" };
}
async function answer(text: string): Promise<AssistantReply> {
  const d = await rankedData();
  const t = text.toLowerCase(); const w = whichSet(t);
  const liveIds = (role: "REVIEWER" | "JUDGE", passedOnly = false) => new Set(d.reviews.filter((r) => r.panelRole === role && isLiveReview(r) && (!passedOnly || r.decision === "PASS")).map((r) => r.applicationId));
  const ids = w.set === "batch" ? liveIds("REVIEWER") : w.set === "passed" ? liveIds("REVIEWER", true) : w.set === "judges" ? liveIds("JUDGE")
    : new Set(d.ranked.slice(0, w.set === "top" ? w.n : undefined).map((p) => p.applicationId));
  const set = [...ids].map((id) => d.apps.get(id)).filter((a): a is Application => !!a);
  const label = { eligible: "eligible applicants", batch: "applications with reviewers", passed: "applications reviewers passed", judges: "applications with judges", top: `top ${(w.n ?? 0).toLocaleString("en-GB")} eligible applicants` }[w.set];
  if (!set.length) return { kind: "answer", text: `There are no ${label} yet.`, lines: [] };
  const n = set.length, c = (f: (a: Application) => boolean) => set.filter(f).length;
  const zones = new Map<string, number>(); for (const a of set) zones.set(zoneOf(a.location.state), (zones.get(zoneOf(a.location.state)) ?? 0) + 1);
  const lines: Array<[string, string]> = [
    ["Total", String(n)],
    ["Focal states", `${c(isFocal)} (${pctOf(c(isFocal), n)})`], ["Other states", `${n - c(isFocal)} (${pctOf(n - c(isFocal), n)})`],
    ["Women", `${c((a) => a.applicant.gender === "FEMALE")} (${pctOf(c((a) => a.applicant.gender === "FEMALE"), n)})`],
    ["Persons with disability", `${c((a) => a.inclusion.disability === "YES")} (${pctOf(c((a) => a.inclusion.disability === "YES"), n)})`],
    ["Rural", `${c((a) => a.inclusion.rural)} (${pctOf(c((a) => a.inclusion.rural), n)})`],
    ...[...zones].sort((a, b) => b[1] - a[1]).map(([z, k]): [string, string] => [`Zone: ${z}`, `${k} (${pctOf(k, n)})`]),
  ];
  return { kind: "answer", text: w.set === "top" ? `Here is the make-up of the ${label}.` : `Here is the make-up of the ${n.toLocaleString("en-GB")} ${label}.`, lines };
}

// ───────────── actions: proposed, never done here ─────────────
async function proposeMove(text: string): Promise<AssistantReply> {
  const d = await rankedData();
  const role = /judge/i.test(text) && !/reviewer/i.test(text) ? "JUDGE" : "REVIEWER";
  const people = d.panelists.filter((p) => p.role === role);
  const find = (frag: string) => {
    const f = frag.trim().toLowerCase().replace(/['’]s$/, "");
    if (!f) return null;
    return people.find((p) => p.email === f) ?? people.find((p) => p.name.toLowerCase() === f) ?? people.find((p) => new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(p.name)) ?? null;
  };
  const m = /(?:move|reassign|give|share)\s+(?:all\s+(?:of\s+)?)?(.+?)(?:['’]s)?\s+(?:unfinished\s+|remaining\s+|undone\s+)?(?:work|applications?|list|assignments?)?\s*(?:to|between|among)\s+(.+?)[.?!]*$/i.exec(text.trim());
  const from = m ? find(m[1].replace(/^(?:the\s+)?(?:work|applications?)\s+(?:of|from)\s+/i, "")) : null;
  if (!from) return { kind: "unclear", text: `I could not tell whose work to move. Name the person exactly as on the Staff page, e.g. "Move ${people[0]?.name ?? "Reviewer 4"}'s unfinished work to the others".` };
  const toText = m![2].toLowerCase();
  const to = /other|everyone|evenly|equal|rest/.test(toText) ? null : find(toText);
  if (!/other|everyone|evenly|equal|rest/.test(toText) && !to) return { kind: "unclear", text: `I could not find "${m![2]}" among the ${role === "JUDGE" ? "judges" : "reviewers"}.` };
  const reviewIds = d.reviews.filter((r) => r.panelRole === role && r.panelEmail === from.email && isLiveReview(r) && r.status !== "SUBMITTED" && r.decision !== "PASS").map((r) => r.reviewId);
  if (!reviewIds.length) return { kind: "answer", text: `${from.name} has no unfinished work to move.`, lines: [] };
  const confirm = { action: "move", reviewIds, to: to ? to.email : "EVEN" };
  const preview = await moveReviews({ ...confirm, dryRun: true }, "assistant-preview");
  if (!preview.ok) return { kind: "unclear", text: String((preview.body as { message?: string }).message ?? "That move is not possible.") };
  return { kind: "action", text: `Move ${reviewIds.length} unfinished application(s) from ${from.name} to ${to ? to.name : "the other " + (role === "JUDGE" ? "judges" : "reviewers") + ", shared evenly"}. Passed and scored work stays with ${from.name}.`, preview: preview.data, confirm };
}

async function proposeJudges(text: string): Promise<AssistantReply> {
  const per = Number(/(\d+)\s*judges?\s*(?:each|per|for each)/i.exec(text)?.[1] ?? /each\s+(?:by|with|gets?)\s*(\d+)/i.exec(text)?.[1] ?? 3);
  const confirm = { action: "judges", perApplication: Math.max(1, Math.min(10, per)) };
  const preview = await sendPassedToJudges({ ...confirm, dryRun: true }, "assistant-preview");
  if (!preview.ok) return { kind: "unclear", text: String((preview.body as { message?: string }).message ?? "That is not possible yet.") };
  const pv = preview.data as { creates: number; pool: number; people: number };
  return { kind: "action", text: pv.creates ? `Give the ${pv.pool} passed application(s) to the judges, ${confirm.perApplication} judge(s) each: ${pv.creates} new assignment(s) between ${pv.people} judge(s).` : `Nothing to do: all ${pv.pool} passed applications already have ${confirm.perApplication} judge(s).`, preview: pv as unknown as Record<string, unknown>, confirm: { ...confirm, dryRun: false } };
}

/** Entry point: a sentence, or corrected settings from the preview form. */
export async function ask(input: { text?: string; spec?: unknown }): Promise<AssistantReply> {
  if (input.spec) {
    const p = listSpecSchema.safeParse(input.spec);
    if (!p.success) return { kind: "unclear", text: p.error.issues[0]?.message ?? "Please check the settings." };
    return { kind: "list", spec: p.data, description: describeSpec(p.data), source: "rules", understood: [], unclear: [], report: await listPreview(p.data) };
  }
  const text = (input.text ?? "").trim().slice(0, 600);
  if (text.length < 3) return { kind: "unclear", text: "Type a request, for example: " + EXAMPLES[0] };
  const t = text.toLowerCase();
  if (/\b(move|reassign|share out|give)\b.*\b(work|applications?|assignments?)\b/.test(t) && !/csv|list|download/.test(t)) return proposeMove(text);
  if (/\bsend\b.*\bpassed\b.*\bjudges?\b|\bto (the )?judges\b/.test(t) && !/csv|download/.test(t)) return proposeJudges(text);
  if (/^(how many|what share|what percentage|what is the (make[- ]?up|split)|breakdown|composition)|\bhow many\b/.test(t)) return answer(text);
  if (/csv|list|download|send|give me|generate|best|top|shortlist|\d+\s*%/.test(t)) {
    const rules = parseRequest(text, { size: SCREENING.shortlistSize });
    const fromAi = await aiSpec(text);
    const spec = fromAi ?? rules.spec;
    return { kind: "list", spec, description: describeSpec(spec), source: fromAi ? "ai" : "rules", understood: rules.understood, unclear: fromAi ? [] : rules.unclear, report: await listPreview(spec) };
  }
  return { kind: "unclear", text: `I can build lists, count who is in a list, move reviewers' work, or send passed applications to judges. Try: "${EXAMPLES[0]}".` };
}
