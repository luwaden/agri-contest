/**
 * BALANCED SELECTION (pure).
 *   "180 people: 60 each from Kaduna, Niger and Nasarawa, at least 20% women and 10% PWD,
 *    mixed ages, spread across LGAs, the best applicants"
 *
 * For each state separately (so every state gets exactly its number):
 *   1. LGA spread: every LGA that has eligible applicants gets its best applicant first (while places last),
 *      and no LGA may take more than `lgaCap` of the state's places.
 *   2. Minimums: women, persons with disability and each age band reach their minimum, using the
 *      best-ranked qualifying people; when the state is full, the lowest-ranked person who is not needed
 *      for another minimum gives way.
 *   3. Everything else strictly by pre-score.
 * Never invents people: if a state has too few women or PWD, it says so in the notes.
 */
import type { Application } from "@/types/application";
import type { PreScore } from "./index";

export const AGE_BANDS = [["18–24", 18, 24], ["25–29", 25, 29], ["30–35", 30, 35]] as const;
export const ageBand = (age: number) => AGE_BANDS.find(([, lo, hi]) => age >= lo && age <= hi)?.[0] ?? "other";

export interface BalancedSpec {
  /** state → how many. */
  perState: Record<string, number>;
  minWomenShare?: number | null;
  minPwdShare?: number | null;
  /** Minimum share for EACH age band (e.g. 0.15). null = no age rule. */
  minEachAgeBandShare?: number | null;
  /** Spread across LGAs: every LGA with eligible applicants gets at least one place (while places last). */
  spreadLga?: boolean;
  /** Most places one LGA may take in a state (share of that state's places). */
  lgaCap?: number | null;
}
export interface BalancedRow { position: number; applicationId: string; overallRank: number; state: string; lga: string; placedBy: string }
export interface BalancedReport { rows: BalancedRow[]; byState: Array<{ state: string; wanted: number; got: number; women: number; pwd: number; lgas: number; lgasAvailable: number; ages: Record<string, number> }>; notes: string[] }

const isWoman = (a: Application) => a.applicant.gender === "FEMALE";
const isPwd = (a: Application) => a.inclusion.disability === "YES";
const lgaOf = (a: Application) => (a.location.lga || "").trim().toLowerCase().replace(/\s+/g, " ") || "(not given)";

export function balancedSelect(ranked: PreScore[], applications: Application[], spec: BalancedSpec): BalancedReport {
  const apps = new Map(applications.map((a) => [a.applicationId, a]));
  const all = ranked.map((p, i) => ({ id: p.applicationId, rank: i + 1, a: apps.get(p.applicationId)! })).filter((x) => x.a);
  type X = (typeof all)[number] & { placedBy?: string };
  const notes: string[] = []; const rows: BalancedRow[] = []; const byState: BalancedReport["byState"] = [];

  for (const [state, wanted] of Object.entries(spec.perState)) {
    const pool = all.filter((x) => x.a.location.state.toLowerCase() === state.toLowerCase());
    const n = Math.min(wanted, pool.length);
    if (n < wanted) notes.push(`${state}: only ${pool.length} eligible applicants, so ${n} instead of ${wanted}.`);
    const cap = spec.lgaCap ? Math.max(1, Math.ceil(n * spec.lgaCap)) : Infinity;
    const chosen: X[] = [];
    const lgaCount = (l: string) => chosen.filter((c) => lgaOf(c.a) === l).length;
    const add = (x: X, why: string) => { if (!chosen.includes(x)) chosen.push({ ...x, placedBy: why }); };
    const has = (x: X) => chosen.some((c) => c.id === x.id);

    // 1. LGA spread: best of each LGA, best LGAs first.
    const lgas = [...new Set(pool.map((x) => lgaOf(x.a)))];
    if (spec.spreadLga) for (const x of lgas.map((l) => pool.find((p) => lgaOf(p.a) === l)!).sort((a, b) => a.rank - b.rank)) { if (chosen.length >= n) break; add(x, "LGA spread"); }
    // 3 (first pass). Fill by rank, respecting the LGA cap.
    for (const x of pool) { if (chosen.length >= n) break; if (!has(x) && lgaCount(lgaOf(x.a)) < cap) add(x, "Rank"); }
    for (const x of pool) { if (chosen.length >= n) break; if (!has(x)) add(x, "Rank"); }   // cap relaxed only if the state cannot be filled otherwise

    // 2. Minimums, by swapping in the best qualifying people for the weakest ones not needed elsewhere.
    const rules: Array<[string, number, (a: Application) => boolean]> = [];
    if (spec.minWomenShare) rules.push(["women", Math.ceil(n * spec.minWomenShare), isWoman]);
    if (spec.minPwdShare) rules.push(["persons with disability", Math.ceil(n * spec.minPwdShare), isPwd]);
    if (spec.minEachAgeBandShare) for (const [band] of AGE_BANDS) rules.push([`age ${band}`, Math.ceil(n * spec.minEachAgeBandShare), (a) => ageBand(a.applicant.age) === band]);
    const needed = (x: X, except: number) => rules.some(([, min, test], j) => j !== except && test(x.a) && chosen.filter((c) => test(c.a)).length <= min)
      || (spec.spreadLga && lgaCount(lgaOf(x.a)) === 1);
    rules.forEach(([label, min, test], j) => {
      const target = Math.min(min, pool.filter((x) => test(x.a)).length);
      while (chosen.filter((c) => test(c.a)).length < target) {
        const inc = pool.find((x) => !has(x) && test(x.a)); if (!inc) break;
        const out = [...chosen].sort((a, b) => b.rank - a.rank).find((c) => !test(c.a) && !needed(c, j));
        if (!out) break;
        chosen.splice(chosen.indexOf(out), 1); add(inc, `Minimum: ${label}`);
      }
      const got = chosen.filter((c) => test(c.a)).length;
      if (got < min) notes.push(`${state}: ${got} ${label} (wanted at least ${min})${pool.filter((x) => test(x.a)).length < min ? `; only ${pool.filter((x) => test(x.a)).length} eligible in the state` : ""}.`);
    });

    chosen.sort((a, b) => a.rank - b.rank);
    for (const c of chosen) rows.push({ position: rows.length + 1, applicationId: c.id, overallRank: c.rank, state: c.a.location.state, lga: c.a.location.lga, placedBy: c.placedBy ?? "Rank" });
    const ages: Record<string, number> = {}; for (const c of chosen) { const b = ageBand(c.a.applicant.age); ages[b] = (ages[b] ?? 0) + 1; }
    byState.push({ state, wanted, got: chosen.length, women: chosen.filter((c) => isWoman(c.a)).length, pwd: chosen.filter((c) => isPwd(c.a)).length,
      lgas: new Set(chosen.map((c) => lgaOf(c.a))).size, lgasAvailable: lgas.length, ages });
  }
  return { rows, byState, notes };
}
