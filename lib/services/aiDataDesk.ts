import "server-only";
import { randomBytes } from "node:crypto";
import { getAIProvider } from "@/lib/ai";
import type { AIMessage } from "@/lib/ai/types";
import { getRepository } from "@/lib/repository";
import { createOutputTab, outputTabsAvailable } from "@/lib/google-sheets/outputTabs";
import { FOCAL_STATES, zoneOf } from "@/config/admin";
import { isLiveReview } from "@/types/review";
import { buildResults } from "@/lib/judging";
import type { Application } from "@/types/application";
import type { PreScore } from "@/lib/screening";
import { rankedData, toCsv } from "./screeningService";
import { balancedSelect, ageBand } from "@/lib/screening/balanced";

/**
 * AI DATA DESK (administrators only).
 *
 *   admin question ──▶ AI ──(JSON tool calls)──▶ search / count / open ONE application   (read only, run here, over all rows)
 *                                     └────────▶ create_sheet: a NEW "AI · …" tab + CSV  (the only write; never an existing tab)
 *
 * The AI never gets credentials or a connection; it asks for data through these four tools and gets plain JSON back.
 * Personal contact details reach the AI only when AI_FULL_DATA_ACCESS=true. They can always be put INTO a new sheet,
 * because that stays in the programme's own Google account.
 */
export const fullAccess = () => process.env.AI_FULL_DATA_ACCESS === "true";
const MAX_STEPS = 8, AI_ROWS = 50, SHEET_ROWS = 20_000, TEXT_TO_AI = 600;

// ───────────── the data the AI can see ─────────────
type Ctx = { s?: PreScore; reviewer?: string; reviewStatus?: string; passed?: boolean; judges?: number | null; zone: string };
type Field = { get: (a: Application, c: Ctx) => string | number | boolean | null; pii?: true; text?: true; about: string };
const yes = (b: boolean) => b;
export const FIELDS: Record<string, Field> = {
  application_id: { get: (a) => a.applicationId, about: "reference" },
  status: { get: (a) => a.submissionStatus, about: "SUBMITTED, UNDER_REVIEW, SHORTLISTED, NOT_SELECTED, FINALIST, WINNER" },
  submitted_at: { get: (a) => a.submittedAt, about: "ISO date" },
  first_name: { get: (a) => a.applicant.firstName, about: "" }, last_name: { get: (a) => a.applicant.lastName, about: "" },
  gender: { get: (a) => a.applicant.gender, about: "FEMALE or MALE" }, age: { get: (a) => a.applicant.age, about: "years" },
  date_of_birth: { get: (a) => a.applicant.dateOfBirth, pii: true, about: "" },
  phone: { get: (a) => a.applicant.phone, pii: true, about: "" }, whatsapp: { get: (a) => a.applicant.whatsapp, pii: true, about: "" },
  email: { get: (a) => a.applicant.email, pii: true, about: "" }, address: { get: (a) => a.applicant.address, pii: true, about: "" },
  nationality: { get: (a) => a.applicant.nationality, about: "" },
  state: { get: (a) => a.location.state, about: "Nigerian state" }, lga: { get: (a) => a.location.lga, about: "" },
  zone: { get: (_a, c) => c.zone, about: "geopolitical zone" },
  focal_state: { get: (a) => yes((FOCAL_STATES as readonly string[]).includes(a.location.state)), about: `true for ${FOCAL_STATES.join(", ")}` },
  rural: { get: (a) => a.inclusion.rural, about: "boolean" },
  disability: { get: (a) => a.inclusion.disability, about: "YES, NO, PREFER_NOT_TO_SAY" },
  disability_type: { get: (a) => a.inclusion.disabilityType, pii: true, about: "" },
  business_name: { get: (a) => a.business.businessName, about: "" },
  registration_status: { get: (a) => a.business.registrationStatus, about: "CAC_REGISTERED, IN_PROGRESS, NOT_REGISTERED" },
  year_started: { get: (a) => a.business.yearStarted, about: "" },
  value_chain: { get: (a) => (a.business.valueChain === "OTHER" && a.business.valueChainOther ? `OTHER: ${a.business.valueChainOther}` : a.business.valueChain), about: "MAIZE, RICE, SOYBEAN, ALLIED, OTHER…" },
  business_stage: { get: (a) => a.business.stage, about: "IDEA, EARLY, OPERATING, GROWING, ESTABLISHED" },
  applicant_role: { get: (a) => a.business.applicantRole, about: "" },
  description: { get: (a) => a.business.description, text: true, about: "answer" }, problem: { get: (a) => a.business.problem, text: true, about: "answer" },
  solution: { get: (a) => a.business.solution, text: true, about: "answer" }, originality: { get: (a) => a.business.originality, text: true, about: "answer" },
  innovation: { get: (a) => a.business.innovation, text: true, about: "answer" }, main_customers: { get: (a) => a.business.mainCustomers, text: true, about: "answer" },
  target_market: { get: (a) => a.business.targetMarket, text: true, about: "answer" }, revenue_source: { get: (a) => a.business.revenueSource, text: true, about: "answer" },
  customers_served: { get: (a) => a.business.customersServed, about: "number" }, generates_revenue: { get: (a) => a.business.generatesRevenue, about: "boolean" },
  revenue_range: { get: (a) => a.business.revenueRange, about: "NONE, UNDER_1M, 1M_5M, 5M_20M, 20M_50M, OVER_50M" },
  employees_full_time: { get: (a) => a.business.employees.fullTime, about: "number" }, employees_women: { get: (a) => a.business.employees.women, about: "number" },
  employees_youth: { get: (a) => a.business.employees.youth, about: "number" },
  farmers_reached: { get: (a) => a.impact.farmersReached, about: "number" }, jobs_created: { get: (a) => a.impact.jobsCreated, about: "number" },
  women_reached: { get: (a) => a.impact.womenReached, about: "number" }, youth_reached: { get: (a) => a.impact.youthReached, about: "number" },
  communities_reached: { get: (a) => a.impact.communitiesReached, about: "number" },
  social_impact: { get: (a) => a.impact.socialImpact, text: true, about: "answer" }, environmental_impact: { get: (a) => a.impact.environmentalImpact, text: true, about: "answer" },
  support_needs: { get: (a) => a.supportNeeds.join("; "), about: "list" }, programme_goal: { get: (a) => a.programmeGoal, text: true, about: "answer" },
  eligible: { get: (_a, c) => c.s?.eligible ?? false, about: "passes the programme's eligibility rules" },
  not_eligible_because: { get: (_a, c) => c.s?.ineligibleReasons.join("; ") ?? "", about: "" },
  pre_score: { get: (_a, c) => c.s?.total ?? null, about: "automatic score out of 100 (same 5 criteria and weights as the judges)" },
  score_originality: { get: (_a, c) => c.s?.scores.originality ?? null, about: "1-10" }, score_feasibility: { get: (_a, c) => c.s?.scores.feasibility ?? null, about: "1-10" },
  score_scalability: { get: (_a, c) => c.s?.scores.scalability ?? null, about: "1-10" }, score_impact: { get: (_a, c) => c.s?.scores.impact ?? null, about: "1-10" },
  score_market: { get: (_a, c) => c.s?.scores.market ?? null, about: "1-10" },
  strengths: { get: (_a, c) => c.s?.strengths.join("; ") ?? "", about: "" }, weaknesses: { get: (_a, c) => c.s?.weaknesses.join("; ") ?? "", about: "" },
  flags: { get: (_a, c) => c.s?.flags.join("; ") ?? "", about: "things to check" },
  reviewer: { get: (_a, c) => c.reviewer ?? "", about: "screening reviewer's name, if assigned" },
  review_status: { get: (_a, c) => c.reviewStatus ?? "", about: "ASSIGNED, IN_PROGRESS, SUBMITTED" },
  passed_by_reviewer: { get: (_a, c) => c.passed ?? false, about: "boolean" },
  judges_average: { get: (_a, c) => c.judges ?? null, about: "average of submitted judge score sheets" },
};
const allowedToAI = (f: string) => !!FIELDS[f] && (fullAccess() || !FIELDS[f].pii);

async function table() {
  const d = await rankedData();
  const rev = new Map<string, { name: string; status: string; passed: boolean }>();
  for (const r of d.reviews) if (r.panelRole === "REVIEWER" && isLiveReview(r)) rev.set(r.applicationId, { name: r.panelName, status: r.status, passed: r.decision === "PASS" });
  const judged = new Map(buildResults(d.applications, d.reviews, "JUDGE").map((r) => [r.applicationId, r.average]));
  const rows = d.applications.filter((a) => a.submissionStatus !== "DRAFT").map((a) => {
    const x = rev.get(a.applicationId);
    return { a, c: { s: d.byId.get(a.applicationId), reviewer: x?.name, reviewStatus: x?.status, passed: x?.passed, judges: judged.get(a.applicationId) ?? null, zone: zoneOf(a.location.state) } as Ctx };
  });
  return rows;
}
type Row = Awaited<ReturnType<typeof table>>[number];

// ───────────── query language (validated by hand, so a confused AI gets a clear error back) ─────────────
type Filter = { field: string; op: "eq" | "neq" | "in" | "contains" | "gte" | "lte" | "exists"; value?: unknown };
type Sort = { field: string; desc?: boolean };
const val = (r: Row, f: string) => FIELDS[f].get(r.a, r.c);
function check(fields: string[], forAI: boolean) {
  for (const f of fields) {
    if (!FIELDS[f]) throw new Error(`Unknown field "${f}".`);
    if (forAI && !allowedToAI(f)) throw new Error(`Field "${f}" is personal data and is not shared with the AI. You can still include it in create_sheet.`);
  }
}
function applyFilters(rows: Row[], filters: Filter[] = [], forAI: boolean): Row[] {
  check(filters.map((f) => f.field), forAI);
  return rows.filter((r) => filters.every((f) => {
    const v = val(r, f.field); const s = String(v ?? "").toLowerCase(); const w = f.value;
    switch (f.op) {
      case "eq": return s === String(w ?? "").toLowerCase();
      case "neq": return s !== String(w ?? "").toLowerCase();
      case "in": return Array.isArray(w) && w.map((x) => String(x).toLowerCase()).includes(s);
      case "contains": return s.includes(String(w ?? "").toLowerCase());
      case "gte": return v != null && v !== "" && Number(v) >= Number(w);
      case "lte": return v != null && v !== "" && Number(v) <= Number(w);
      case "exists": return v != null && v !== "" && v !== false;
      default: throw new Error(`Unknown filter op "${(f as Filter).op}". Use eq, neq, in, contains, gte, lte, exists.`);
    }
  }));
}
function applySort(rows: Row[], sort: Sort[] = []) {
  check(sort.map((s) => s.field), false);
  return [...rows].sort((x, y) => {
    for (const s of sort) {
      const a = val(x, s.field), b = val(y, s.field);
      const c = typeof a === "number" || typeof b === "number" ? (Number(a ?? -Infinity) - Number(b ?? -Infinity)) : String(a ?? "").localeCompare(String(b ?? ""));
      if (c) return s.desc ? -c : c;
    }
    return 0;
  });
}
const cell = (v: unknown) => (v == null ? "" : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));

// ───────────── the tools ─────────────
type Out = { id: string; title: string; tab: string | null; url: string | null; rows: number; csv: string; at: number };
const outputs: Map<string, Out> = ((globalThis as { __agraAIOut?: Map<string, Out> }).__agraAIOut ??= new Map());
export const getOutput = (id: string) => { const o = outputs.get(id); return o && Date.now() - o.at < 3 * 3600_000 ? o : null; };

async function runTool(name: string, args: Record<string, unknown>, rows: Row[], actor: string, made: Out[]): Promise<unknown> {
  if (name === "search") {
    const fields = (Array.isArray(args.fields) && args.fields.length ? args.fields : ["application_id", "first_name", "last_name", "state", "business_name", "pre_score"]) as string[];
    check(fields, true);
    const hit = applySort(applyFilters(rows, args.filters as Filter[], true), args.sort as Sort[]);
    const limit = Math.max(1, Math.min(AI_ROWS, Number(args.limit) || 20)), offset = Math.max(0, Number(args.offset) || 0);
    return { matched: hit.length, showing: `${offset + 1}-${Math.min(hit.length, offset + limit)}`,
      rows: hit.slice(offset, offset + limit).map((r) => Object.fromEntries(fields.map((f) => { const v = val(r, f); return [f, FIELDS[f].text && typeof v === "string" ? v.slice(0, TEXT_TO_AI) : v]; }))) };
  }
  if (name === "count") {
    const hit = applyFilters(rows, args.filters as Filter[], true);
    const by = args.group_by as string | undefined;
    if (!by) return { count: hit.length };
    check([by], true);
    const m = new Map<string, number>(); for (const r of hit) { const k = cell(val(r, by)) || "(blank)"; m.set(k, (m.get(k) ?? 0) + 1); }
    return { count: hit.length, groups: [...m].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, n]) => ({ [by]: k, count: n })) };
  }
  if (name === "get_application") {
    const r = rows.find((x) => x.a.applicationId === String(args.application_id ?? "").trim().toUpperCase());
    if (!r) return { error: "No application with that reference." };
    return Object.fromEntries(Object.keys(FIELDS).filter(allowedToAI).map((f) => [f, val(r, f)]));
  }
  if (name === "create_sheet") {
    const title = String(args.title ?? "Results").slice(0, 60);
    let header: string[], body: string[][];
    if (Array.isArray(args.rows)) {          // the AI's own table (e.g. summaries it wrote), up to 1,000 rows
      header = (Array.isArray(args.columns) ? args.columns : []).map((c) => String(c).slice(0, 80));
      if (!header.length) throw new Error("create_sheet with rows needs columns.");
      body = (args.rows as unknown[]).slice(0, 1000).map((r) => (Array.isArray(r) ? r : []).slice(0, header.length).map(cell));
    } else {                                 // a query over all applications, up to 20,000 rows; may include contact details
      const fields = (Array.isArray(args.fields) && args.fields.length ? args.fields : ["application_id", "first_name", "last_name", "email", "phone", "state", "business_name", "pre_score"]) as string[];
      check(fields, false);
      const hit = applySort(applyFilters(rows, args.filters as Filter[], false), args.sort as Sort[]).slice(0, Math.min(SHEET_ROWS, Number(args.limit) || SHEET_ROWS));
      const notes = (args.notes && typeof args.notes === "object" ? args.notes : {}) as Record<string, string>;   // optional AI-written note per application
      const hasNotes = Object.keys(notes).length > 0;
      header = ["#", ...fields, ...(hasNotes ? [String(args.notes_column ?? "AI note").slice(0, 60)] : [])];
      body = hit.map((r, i) => [String(i + 1), ...fields.map((f) => cell(val(r, f))), ...(hasNotes ? [String(notes[r.a.applicationId] ?? "").slice(0, 2000)] : [])]);
    }
    if (!body.length) return { error: "Nothing matched, so no sheet was created." };
    const csv = toCsv(header, body);
    let tab: string | null = null, url: string | null = null, sheetError: string | null = null;
    if (outputTabsAvailable()) { try { ({ tab, url } = await createOutputTab(title, header, body)); } catch (e) { sheetError = String((e as Error)?.message ?? e).slice(0, 200); } }
    const out: Out = { id: randomBytes(9).toString("base64url"), title, tab, url, rows: body.length, csv, at: Date.now() };
    outputs.set(out.id, out); made.push(out);
    await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor, action: "AI_SHEET_CREATED", detail: `${tab ?? "(CSV only)"} | ${body.length} rows | ${header.join(",").slice(0, 300)}` }).catch(() => {});
    return { created: true, rows: body.length, tab: tab ?? "(download only)", ...(sheetError ? { note: `New tab could not be created (${sheetError}); the CSV download is ready.` } : {}) };
  }
  if (name === "balanced_sheet") {
    const per = (args.per_state && typeof args.per_state === "object" ? args.per_state : {}) as Record<string, unknown>;
    const perState = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, Math.max(0, Math.min(5000, Math.round(Number(v) || 0)))]).filter(([, v]) => (v as number) > 0)) as Record<string, number>;
    if (!Object.keys(perState).length) throw new Error("balanced_sheet needs per_state, e.g. {\"Kaduna\":60}.");
    const share = (v: unknown) => (v == null || v === "" ? null : Math.max(0, Math.min(1, Number(v) > 1 ? Number(v) / 100 : Number(v))));
    const d = await rankedData();
    const r = balancedSelect(d.ranked, d.applications, { perState, minWomenShare: share(args.min_women_share), minPwdShare: share(args.min_pwd_share),
      minEachAgeBandShare: share(args.min_each_age_band_share), spreadLga: args.spread_lga !== false, lgaCap: share(args.lga_cap ?? 0.25) });
    const fields = (Array.isArray(args.fields) && args.fields.length ? args.fields : ["first_name", "last_name", "email", "phone", "gender", "age", "state", "lga", "business_name", "value_chain", "pre_score", "strengths"]) as string[];
    check(fields, false);
    const byId = new Map(rows.map((x) => [x.a.applicationId, x]));
    const header = ["#", "application_id", ...fields.filter((f) => f !== "application_id"), "disability", "age_band", "placed_by"];
    const body = r.rows.map((x) => { const row = byId.get(x.applicationId)!; return [String(x.position), x.applicationId, ...fields.filter((f) => f !== "application_id").map((f) => cell(val(row, f))), row.a.inclusion.disability, ageBand(row.a.applicant.age), x.placedBy]; });
    if (!body.length) return { error: "No eligible applicants matched those states." };
    const res = await runTool("create_sheet", { title: String(args.title ?? "Balanced selection"), columns: header, rows: body.slice(0, 1000) }, rows, actor, made);
    return { ...(res as object), by_state: r.byState, notes: r.notes };
  }
  throw new Error(`Unknown tool "${name}". Use search, count, get_application, create_sheet or balanced_sheet.`);
}

// ───────────── the conversation ─────────────
function systemPrompt() {
  const list = Object.entries(FIELDS).map(([k, f]) => `${k}${f.pii ? (fullAccess() ? " [personal]" : " [personal: sheet only]") : ""}${f.about ? ` (${f.about})` : ""}`).join("; ");
  return `You are the data assistant of the AGRA–SMEDAN Youth Agri-Innovation Contest programme team. You help administrators understand the applications and prepare lists.
You CANNOT change any data. Your only output besides your answer is create_sheet, which adds a NEW tab and a CSV download. Never claim you changed a status, sent an email or edited anything.
Reply with exactly ONE JSON object and nothing else:
  {"tool":"search","args":{"filters":[{"field":"state","op":"eq","value":"Kaduna"}],"sort":[{"field":"pre_score","desc":true}],"fields":["application_id","business_name","pre_score"],"limit":20,"offset":0}}
  {"tool":"count","args":{"filters":[...],"group_by":"gender"}}
  {"tool":"get_application","args":{"application_id":"AGRA-2026-XXXXXX"}}
  {"tool":"create_sheet","args":{"title":"…","filters":[...],"sort":[...],"fields":[...],"limit":1300,"notes":{"AGRA-…":"your note"},"notes_column":"Why shortlisted"}}
  {"tool":"create_sheet","args":{"title":"…","columns":["…"],"rows":[["…"]]}}
  {"tool":"balanced_sheet","args":{"title":"…","per_state":{"Kaduna":60,"Niger":60,"Nasarawa":60},"min_women_share":0.2,"min_pwd_share":0.1,"min_each_age_band_share":0.15,"spread_lga":true,"lga_cap":0.25,"fields":["first_name","last_name","email","phone","gender","age","state","lga","business_name","value_chain","pre_score"]}}
  {"answer":"your final answer in plain English for the administrator"}
Filter ops: eq, neq, in (value is a list), contains, gte, lte, exists. search returns at most ${AI_ROWS} rows per call (use offset), long answers cut to ${TEXT_TO_AI} characters; count works on all rows; create_sheet works on up to ${SHEET_ROWS} rows directly, so for big lists describe them with filters and sort rather than listing rows.
Fields: ${list}.
For any request that fixes numbers per state and/or asks for minimum shares of women, PWD, age mix or LGA spread, call balanced_sheet ONCE: it picks the best eligible applicants under all those rules over every row and creates the sheet. Do not try to pick such lists yourself with search. Age bands are 18–24, 25–29, 30–35.
Rules: base every number on tool results, never guess; say how many records a statement covers; the pre_score is an automatic estimate, not a judge's decision; be brief and plain; at most ${MAX_STEPS} tool calls.`;
}

function parseReply(text: string): { tool?: string; args?: Record<string, unknown>; answer?: string } {
  const t = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  if (start === -1 || end === -1) return { answer: t };
  try { return JSON.parse(t.slice(start, end + 1)); } catch { return { answer: t }; }
}

export interface DeskReply { answer: string; steps: string[]; outputs: Array<{ id: string; title: string; tab: string | null; url: string | null; rows: number }>; fullAccess: boolean }

export async function askDataDesk(question: string, history: AIMessage[], actor: string): Promise<{ ok: true; data: DeskReply } | { ok: false; status: number; message: string }> {
  const q = question.trim();
  if (q.length < 3 || q.length > 2000) return { ok: false, status: 400, message: "Please write a request between 3 and 2,000 characters." };
  const ai = getAIProvider();
  if (!ai?.configured()) return { ok: false, status: 503, message: "The AI is not switched on. Set AI_PROVIDER and the provider's API key and model in the server environment, then restart." };
  const rows = await table();
  const messages: AIMessage[] = [...history.slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })), { role: "user", content: q }];
  const steps: string[] = [], made: Out[] = [];
  let answer = "";
  for (let i = 0; i <= MAX_STEPS; i++) {
    let out = await ai.complete({ system: systemPrompt(), messages, maxTokens: 4000 });
    if (!out.text.trim()) {   // some models spend the whole budget thinking and return nothing: ask once more, briefly
      out = await ai.complete({ system: systemPrompt(), messages: [...messages, { role: "user", content: "Your last reply was empty. Reply now with exactly one JSON object (a tool call or the answer)." }], maxTokens: 4000 });
      if (!out.text.trim()) { answer = "The AI returned an empty reply twice, so I stopped. Nothing was changed." + (made.length ? " The sheet(s) below were already created." : " Please try again, or ask for a smaller list."); break; }
    }
    const r = parseReply(out.text);
    if (!r.tool || i === MAX_STEPS) { answer = r.answer ?? (r.tool ? "I needed more steps than allowed. Please narrow the request." : out.text); break; }
    let result: unknown;
    try { result = await runTool(r.tool, r.args ?? {}, rows, actor, made); }
    catch (e) { result = { error: String((e as Error)?.message ?? e).slice(0, 300) }; }
    steps.push(describeStep(r.tool, r.args ?? {}, result));
    messages.push({ role: "assistant", content: JSON.stringify({ tool: r.tool, args: r.args ?? {} }).slice(0, 8000) });
    messages.push({ role: "user", content: `TOOL RESULT (${r.tool}): ${JSON.stringify(result).slice(0, 30_000)}` });
  }
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor, action: "AI_DATA_QUERY", detail: `${ai.name} | personal data to AI: ${fullAccess() ? "yes" : "no"} | ${steps.length} step(s), ${made.length} sheet(s) | ${q.slice(0, 200)}` }).catch(() => {});
  return { ok: true, data: { answer, steps, outputs: made.map(({ id, title, tab, url, rows: n }) => ({ id, title, tab, url, rows: n })), fullAccess: fullAccess() } };
}

function describeStep(tool: string, args: Record<string, unknown>, result: unknown): string {
  const r = result as { error?: string; matched?: number; count?: number; rows?: number; tab?: string };
  if (r?.error) return `${tool}: ${r.error}`;
  if (tool === "search") return `Searched applications: ${r.matched} matched`;
  if (tool === "count") return `Counted: ${r.count}${args.group_by ? ` by ${args.group_by}` : ""}`;
  if (tool === "get_application") return `Opened ${String(args.application_id)}`;
  if (tool === "create_sheet" || tool === "balanced_sheet") return `Created ${r.tab} (${r.rows} rows)`;
  return tool;
}
