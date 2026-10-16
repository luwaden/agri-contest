/**
 * CUSTOM LISTS FROM A PLAIN-LANGUAGE REQUEST (admin only).
 *
 *   "send the csv of the best 1300, 60% focal states, 40% other states, 20% women"
 *        │ parseRequest (rules)  or  the AI, which only turns the sentence into these settings
 *        ▼
 *   ListSpec (validated)  ──buildList──▶  ordered list + a report of what was met and what could not be
 *
 * Pure functions: no I/O, no applicant data ever goes to the AI. The admin sees the settings and the report
 * before anything is downloaded, and can correct the settings.
 */
import { z } from "zod";
import type { Application } from "@/types/application";
import type { PreScore } from "./index";
import { FOCAL_STATES } from "@/config/admin";
import { NIGERIAN_STATES, VALUE_CHAINS } from "@/config/programme";

const share = z.number().min(0).max(1);
export const listSpecSchema = z.object({
  size: z.number().int().min(1).max(20_000),
  /** Exact shares of the list by location. If both are set and add up to less than 1, the rest comes from anywhere. */
  focalShare: share.nullable().default(null),
  otherShare: share.nullable().default(null),
  /** Minimum shares (at least this many). */
  minWomenShare: share.nullable().default(null),
  minPwdShare: share.nullable().default(null),
  minRuralShare: share.nullable().default(null),
  /** Apply the minimums to the first N places of the list (e.g. "in the first 300"). null = the whole list. */
  minimumsWithinFirst: z.number().int().min(1).max(20_000).nullable().default(null),
  /** Optional filters. */
  states: z.array(z.string().max(60)).max(40).default([]),
  valueChains: z.array(z.string().max(40)).max(10).default([]),
}).refine((s) => (s.focalShare ?? 0) + (s.otherShare ?? 0) <= 1.0001, { message: "Focal and other-state shares add up to more than 100%." });
export type ListSpec = z.infer<typeof listSpecSchema>;

const FOCAL = new Set<string>(FOCAL_STATES as readonly string[]);
export const isFocal = (a: Application) => FOCAL.has(a.location.state);
const isWoman = (a: Application) => a.applicant.gender === "FEMALE";
const isPwd = (a: Application) => a.inclusion.disability === "YES";
const isRural = (a: Application) => a.inclusion.rural;

// ───────────── reading the request (no AI needed) ─────────────
const num = (s: string) => Number(s.replace(/[,\s]/g, ""));
const pct = (text: string, words: string) => {
  // "60% focal", "focal 60%", "60 percent from focal", "focal states: 60%"
  const a = new RegExp(`(\\d{1,3}(?:\\.\\d+)?)\\s*(?:%|percent|per cent)\\s*(?:of\\s+|from\\s+(?:the\\s+)?|are\\s+|should be\\s+|solid\\s+applications?\\s+from\\s+(?:the\\s+)?)?(?:${words})`, "i").exec(text);
  const b = new RegExp(`(?:${words})[^\\d%]{0,25}?(\\d{1,3}(?:\\.\\d+)?)\\s*(?:%|percent|per cent)`, "i").exec(text);
  const v = a?.[1] ?? b?.[1];
  return v == null ? null : Math.min(1, Number(v) / 100);
};

export function parseRequest(text: string, defaults: { size: number }): { spec: ListSpec; understood: string[]; unclear: string[] } {
  const t = ` ${text.replace(/\s+/g, " ")} `;
  const understood: string[] = [], unclear: string[] = [];
  // Size: "1300", "1,300", "top 500", "best 200". Ignore numbers that are percentages or "first N".
  const firstN = /(?:first|top)\s+(\d[\d,]*)\s*(?:places?|positions?|rows?|of the list)?\s*(?:\)|,|\.|$|should|must|have|include|are)/i.exec(t);
  const inFirst = /(?:in|within|among)\s+(?:the\s+)?(?:first|top)\s+(\d[\d,]*)/i.exec(t);
  const sizes = [...t.matchAll(/(?<![\d.])(\d{1,2},\d{3}|\d{2,5})(?![\d.]*\s*(?:%|percent|per cent))/gi)].map((m) => ({ v: num(m[1]), at: m.index ?? 0 }))
    .filter((m) => m.v >= 10 && m.v <= 20_000 && !(inFirst && num(inFirst[1]) === m.v && m.at >= (inFirst.index ?? 0)) && !(m.v >= 1900 && m.v <= 2100));
  const size = sizes[0]?.v ?? defaults.size;
  if (!sizes.length) unclear.push(`No list size found; using ${defaults.size}.`);
  const within = inFirst ? num(inFirst[1]) : null;

  const focalShare = pct(t, "focal(?:\\s+states?)?");
  const otherShare = pct(t, "(?:the\\s+)?other(?:\\s+states?)?|non[- ]focal(?:\\s+states?)?");
  // "20% women and pwd" → women 20%; PWD has no number of its own unless one is given right next to it.
  const minWomenShare = pct(t, "women|female|girls");
  const pwdOwn = /(\d{1,3})\s*(?:%|percent)\s*(?:of\s+)?(?:pwds?|persons? with disabilit|people with disabilit|disabled)/i.exec(t) ?? /(?:pwds?|disabilit\w*|disabled)\s*[^\d%]{0,10}(\d{1,3})\s*(?:%|percent)/i.exec(t);
  const minPwdShare = pwdOwn ? Math.min(1, Number(pwdOwn[1]) / 100) : null;
  const minRuralShare = pct(t, "rural");
  if (/pwd|disab/i.test(t) && minPwdShare == null) understood.push("PWD: no share of their own was given, so they get no fixed number; the report shows how many are included.");

  // A state filter only when the request says "only <state>" (naming a state otherwise is not a filter).
  const states = (NIGERIAN_STATES as readonly string[]).filter((s) => new RegExp(`\\bonly\\s+(?:from\\s+|in\\s+)?${s}\\b`, "i").test(t));
  const valueChains = VALUE_CHAINS.filter((v) => v.value !== "OTHER" && new RegExp(`\\b(?:only|just)\\s+(?:the\\s+)?${v.label.split(" ")[0]}\\b`, "i").test(t)).map((v) => v.value);

  const raw = { size, focalShare, otherShare, minWomenShare, minPwdShare, minRuralShare, minimumsWithinFirst: within, states, valueChains };
  const p = listSpecSchema.safeParse(raw);
  if (!p.success) { unclear.push(p.error.issues[0]?.message ?? "Some settings were not valid."); return { spec: listSpecSchema.parse({ ...raw, focalShare: null, otherShare: null }), understood, unclear }; }
  if (firstN && !inFirst && !sizes.length) unclear.push("Check the list size.");
  return { spec: p.data, understood, unclear };
}

export function describeSpec(s: ListSpec): string {
  const n = (x: number) => Math.round(x).toLocaleString("en-GB");
  const parts = [`The best ${n(s.size)} eligible applicants by pre-score`];
  if (s.focalShare != null) parts.push(`${Math.round(s.focalShare * 100)}% (${n(s.size * s.focalShare)}) from the focal states (${[...FOCAL].join(", ")})`);
  if (s.otherShare != null) parts.push(`${Math.round(s.otherShare * 100)}% (${n(s.size * s.otherShare)}) from the other states`);
  const scope = s.minimumsWithinFirst ? `the first ${n(s.minimumsWithinFirst)}` : "the list";
  if (s.minWomenShare != null) parts.push(`at least ${Math.round(s.minWomenShare * 100)}% women in ${scope}`);
  if (s.minPwdShare != null) parts.push(`at least ${Math.round(s.minPwdShare * 100)}% persons with disability in ${scope}`);
  if (s.minRuralShare != null) parts.push(`at least ${Math.round(s.minRuralShare * 100)}% rural in ${scope}`);
  if (s.states.length) parts.push(`only ${s.states.join(", ")}`);
  if (s.valueChains.length) parts.push(`only ${s.valueChains.join(", ")}`);
  return parts.join("; ") + ".";
}

// ───────────── building the list ─────────────
export interface ListRow { position: number; applicationId: string; overallRank: number; placedBy: string }
export interface ListReport {
  rows: ListRow[];
  counts: { total: number; focal: number; other: number; women: number; pwd: number; rural: number };
  scope: { size: number; women: number; pwd: number; rural: number } | null;
  lowestScore: number | null;
  notes: string[];
}

/**
 * 1. Location shares: the best N from the focal states and the best M from the other states (exact, when there are
 *    enough; any shortfall is filled with the best remaining and reported). The rest, if any, is the best of anyone left.
 * 2. Minimums (women, PWD, rural) inside the scope: first by moving the highest-ranked qualifying people from lower in
 *    the list into the scope; if the list itself has too few, by swapping in the best unselected qualifying people from
 *    the SAME location group for the lowest-ranked non-qualifying ones, so the location shares stay exact.
 * Everything else is strictly by pre-score.
 */
export function buildList(ranked: PreScore[], applications: Application[], spec: ListSpec): ListReport {
  const apps = new Map(applications.map((a) => [a.applicationId, a]));
  const notes: string[] = [];
  const pool = ranked.map((p, i) => ({ id: p.applicationId, rank: i + 1, a: apps.get(p.applicationId)!, score: p.total }))
    .filter((x) => x.a && (!spec.states.length || spec.states.includes(x.a.location.state)) && (!spec.valueChains.length || spec.valueChains.includes(x.a.business.valueChain)));
  type X = (typeof pool)[number];
  const size = Math.min(spec.size, pool.length);
  if (size < spec.size) notes.push(`Only ${pool.length} eligible applicants match, so the list has ${size}, not ${spec.size}.`);

  const chosen = new Map<string, X & { placedBy: string }>();
  const take = (list: X[], n: number, why: string) => { let got = 0; for (const x of list) { if (got >= n) break; if (!chosen.has(x.id)) { chosen.set(x.id, { ...x, placedBy: why }); got++; } } return got; };
  const focalPool = pool.filter((x) => isFocal(x.a)), otherPool = pool.filter((x) => !isFocal(x.a));
  const want = { focal: spec.focalShare != null ? Math.round(size * spec.focalShare) : null, other: spec.otherShare != null ? Math.round(size * spec.otherShare) : null };
  if (want.focal != null && want.other != null && want.focal + want.other > size) want.other = size - want.focal;
  if (want.focal != null) { const g = take(focalPool, want.focal, "Best in focal states"); if (g < want.focal) notes.push(`Focal states have only ${g} eligible applicants; ${want.focal - g} place(s) filled from the best remaining.`); }
  if (want.other != null) { const g = take(otherPool, want.other, "Best in other states"); if (g < want.other) notes.push(`Other states have only ${g} eligible applicants; ${want.other - g} place(s) filled from the best remaining.`); }
  take(pool, size - chosen.size, "Rank");

  // Order by rank; then satisfy minimums inside the scope.
  const byRank = <T extends { rank: number }>(xs: T[]) => [...xs].sort((a, b) => a.rank - b.rank);
  let list = byRank([...chosen.values()]);
  const scopeN = Math.min(spec.minimumsWithinFirst ?? list.length, list.length);
  const groupOf = (x: X) => (want.focal != null || want.other != null ? (isFocal(x.a) ? "F" : "O") : "*");
  const minimums: Array<[string, number | null, (a: Application) => boolean]> = [["women", spec.minWomenShare, isWoman], ["persons with disability", spec.minPwdShare, isPwd], ["rural applicants", spec.minRuralShare, isRural]];
  for (const [label, sh, test] of minimums) {
    if (sh == null) continue;
    const need = Math.ceil(scopeN * sh);
    const protectedBy = (x: X) => minimums.some(([, s2, t2]) => s2 != null && t2 !== test && t2(x.a));   // don't undo an earlier minimum
    const count = () => list.slice(0, scopeN).filter((x) => test(x.a)).length;
    // (a) promote from lower in the list into the scope
    while (count() < need) {
      const inside = list.slice(0, scopeN);
      const out = [...inside].reverse().find((x) => !test(x.a) && !protectedBy(x)) ?? [...inside].reverse().find((x) => !test(x.a));
      const inc = list.slice(scopeN).find((x) => test(x.a));
      if (!out || !inc) break;
      const iOut = list.indexOf(out), iInc = list.indexOf(inc);
      list[iOut] = { ...inc, placedBy: `Minimum: ${label}` }; list[iInc] = out;   // swap places: membership (and location shares) unchanged
      list = [...byRank(list.slice(0, scopeN)), ...byRank(list.slice(scopeN))];
    }
    // (b) swap in unselected qualifying people from the same location group
    while (count() < need) {
      const inside = list.slice(0, scopeN);
      const out = [...inside].reverse().find((x) => !test(x.a) && !protectedBy(x)) ?? [...inside].reverse().find((x) => !test(x.a));
      if (!out) break;
      const inList = new Set(list.map((x) => x.id));
      const inc = pool.find((x) => !inList.has(x.id) && test(x.a) && groupOf(x) === groupOf(out));
      if (!inc) break;
      list[list.indexOf(out)] = { ...inc, placedBy: `Minimum: ${label}` };
      list = [...byRank(list.slice(0, scopeN)), ...list.slice(scopeN)];
    }
    const got = count();
    if (got < need) notes.push(`Could reach only ${got} ${label} in ${spec.minimumsWithinFirst ? `the first ${scopeN}` : "the list"} (wanted ${need}): there are not enough eligible ones.`);
  }
  list = [...list.slice(0, scopeN), ...list.slice(scopeN).sort((a, b) => a.rank - b.rank)];

  const rows = list.map((x, i) => ({ position: i + 1, applicationId: x.id, overallRank: x.rank, placedBy: x.placedBy }));
  const cnt = (xs: X[], f: (a: Application) => boolean) => xs.filter((x) => f(x.a)).length;
  const swapped = list.filter((x) => x.placedBy.startsWith("Minimum")).length;
  if (swapped) notes.push(`${swapped} place(s) went to meet a minimum; everyone else is in by pre-score.`);
  return {
    rows,
    counts: { total: list.length, focal: cnt(list, isFocal), other: list.length - cnt(list, isFocal), women: cnt(list, isWoman), pwd: cnt(list, isPwd), rural: cnt(list, isRural) },
    scope: spec.minimumsWithinFirst ? { size: scopeN, women: cnt(list.slice(0, scopeN), isWoman), pwd: cnt(list.slice(0, scopeN), isPwd), rural: cnt(list.slice(0, scopeN), isRural) } : null,
    lowestScore: list.length ? Math.min(...list.map((x) => x.score)) : null,
    notes,
  };
}
