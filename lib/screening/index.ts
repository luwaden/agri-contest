/**
 * AUTOMATIC PRE-SCREENING. Pure functions: no I/O, same input → same output, so every number can be re-checked.
 *
 * 1. checkEligibility: hard programme rules (age, nationality, declaration, complete answers, duplicates).
 * 2. preScore: the framework's 5 criteria (same weights as the judges' rubric), each 1–10, estimated from the
 *    form answers, with the reasons behind every score and flags for people to check.
 * 3. rankEligible / pickWithSpread: the top-N shortlist, then a review batch that keeps a fair spread.
 *
 * It is GUIDANCE for people, not a decision: reviewers and judges make every selection decision.
 */
import type { Application } from "@/types/application";
import { PROGRAMME, NIGERIAN_STATES } from "@/config/programme";
import { DEFAULT_CRITERIA, TIE_BREAK_ORDER } from "@/config/scoring";
import { TARGETS, zoneOf } from "@/config/admin";
import { SCREENING } from "@/config/screening";
import { calculateAge } from "@/lib/dates";

export type CriterionId = "originality" | "feasibility" | "scalability" | "impact" | "market";
export interface PreScore {
  applicationId: string;
  eligible: boolean;
  /** Why the application is not eligible (empty when eligible). */
  ineligibleReasons: string[];
  /** Things a person should look at; they lower or do not affect the score but never exclude on their own. */
  flags: string[];
  scores: Record<CriterionId, number>;
  /** Weighted total out of 100 (framework weights). */
  total: number;
  strengths: string[];
  weaknesses: string[];
  duplicateOf: string | null;
}

// ───────────── text signals ─────────────
const words = (s: string) => (s || "").toLowerCase().match(/[a-zÀ-ɏ0-9₦%]+(?:['’][a-z]+)?/g) ?? [];
export const wordCount = (s: string) => words(s).length;
const norm = (s: string) => words(s).join(" ");

/** 0..1 for how substantial and specific an answer is. Long is not enough: repetition and filler are discounted. */
export function textQuality(s: string, fullAt = 120): number {
  const w = words(s);
  if (w.length < 5) return 0;
  const unique = new Set(w).size / w.length;                          // 1 = no repetition
  const length = Math.min(1, Math.log1p(w.length) / Math.log1p(fullAt));
  const specifics = (s.match(/\d[\d,.]*\s*(%|kg|tons?|tonnes?|ha|hectares?|bags?|litres?|naira|₦|n\b|k\b|m\b|million|thousand|farmers|customers|months?|years?)/gi) ?? []).length;
  const specificity = Math.min(1, specifics / 4);
  const vowels = (s.match(/[aeiou]/gi) ?? []).length / Math.max(1, s.replace(/[^a-z]/gi, "").length);
  const gibberish = vowels < 0.2 || vowels > 0.7;
  let q = 0.65 * length + 0.2 * specificity + 0.15 * Math.min(1, unique / 0.6);
  if (unique < 0.35) q *= 0.5;
  if (gibberish) q *= 0.3;
  return Math.max(0, Math.min(1, q));
}
const has = (s: string, re: RegExp) => re.test((s || "").toLowerCase());
const logScale = (n: number, full: number) => (n > 0 ? Math.min(1, Math.log10(1 + n) / Math.log10(1 + full)) : 0);
const to10 = (x: number) => Math.max(1, Math.min(10, Math.round(1 + 9 * Math.max(0, Math.min(1, x)))));

const STAGE_LEVEL: Record<string, number> = { IDEA: 0.1, EARLY: 0.4, OPERATING: 0.65, GROWING: 0.85, ESTABLISHED: 0.85 };
const REVENUE_LEVEL: Record<string, number> = { NONE: 0, UNDER_1M: 0.35, "1M_5M": 0.6, "5M_20M": 0.8, "20M_50M": 0.9, OVER_50M: 1 };
const INNOVATION_WORDS = /\b(app|digital|platform|sms|ussd|solar|drone|sensor|iot|ai\b|data|mobile|machine|mechani[sz]|process(ing|or)|dryer|storage|cold|recycl|compost|biochar|fortif|value[- ]add|packag|traceab|blockchain|irrigat|hydroponic|aquaponic|bio-?fertil|organic fertil|feed)/;
const SCALE_WORDS = /\b(expan|scale|replicat|franchise|other states|across nigeria|nationwide|export|west africa|ecowas|new markets?|partners?hip|distribut|offtake|aggregat|network of)/;

// ───────────── eligibility ─────────────
const STATES = new Set<string>(NIGERIAN_STATES as readonly string[]);
const normPhone = (p: string) => (p || "").replace(/\D/g, "").replace(/^234/, "0").slice(-10);
const isNigerian = (n: string) => /nig/i.test(n || "");

export function checkEligibility(a: Application): string[] {
  const out: string[] = [];
  if (a.submissionStatus === "DRAFT" || !a.submittedAt) out.push("Not submitted");
  const { minAge, maxAge } = PROGRAMME.eligibility;
  const on = a.submittedAt ? new Date(a.submittedAt) : new Date();
  const age = calculateAge(a.applicant.dateOfBirth, Number.isNaN(on.getTime()) ? new Date() : on) ?? (a.applicant.age || null);
  if (age == null) out.push("Date of birth missing or invalid");
  else if (age < minAge || age > maxAge) out.push(`Age ${age} is outside ${minAge}–${maxAge}`);
  if (!isNigerian(a.applicant.nationality)) out.push(`Nationality is "${(a.applicant.nationality || "blank").slice(0, 30)}", not Nigerian`);
  if (!a.declaration.accepted) out.push("Declaration not accepted");
  if (!STATES.has(a.location.state)) out.push(`State "${a.location.state || "blank"}" is not a Nigerian state`);
  for (const [field, min] of Object.entries(SCREENING.minWords)) {
    const n = wordCount((a.business as unknown as Record<string, string>)[field]);
    if (n < min) out.push(`"${field}" answer too short (${n} words; at least ${min} needed)`);
  }
  return out;
}

// ───────────── the five criteria ─────────────
function score(a: Application, copied: boolean) {
  const b = a.business, im = a.impact;
  const strengths: string[] = [], weaknesses: string[] = [], flags: string[] = [];
  const note = (x: number, good: string, bad: string) => { if (x >= 0.7) strengths.push(good); else if (x <= 0.3) weaknesses.push(bad); };

  // Originality (30%): the originality/innovation answers, the solution, concrete innovative elements.
  const qOrig = textQuality(`${b.originality} ${b.innovation}`, 150), qSol = textQuality(b.solution);
  const innovative = has(`${b.solution} ${b.innovation} ${b.originality}`, INNOVATION_WORDS) ? 0.15 : 0;
  let originality = 0.55 * qOrig + 0.3 * qSol + innovative;
  if (copied) { originality *= 0.3; flags.push("Answers identical to another application (possible copy)"); }
  note(originality, "Clear, specific explanation of what is new", "Little explanation of what is new or different");

  // Feasibility (25%): stage, years trading, team, role, registration, how concrete the solution is.
  const years = b.yearStarted ? Math.max(0, new Date(a.submittedAt ?? Date.now()).getUTCFullYear() - b.yearStarted) : 0;
  const team = (b.employees.fullTime || 0) + 0.5 * (b.employees.partTime || 0);
  const leads = ["FOUNDER", "CO_FOUNDER", "OWNER", "DIRECTOR"].includes(b.applicantRole) ? 0.1 : 0;
  const feasibility = 0.35 * (STAGE_LEVEL[b.stage] ?? 0.2) + 0.15 * Math.min(1, years / 4) + 0.15 * logScale(team, 20)
    + leads + (b.registrationStatus === "CAC_REGISTERED" ? 0.1 : b.registrationStatus === "IN_PROGRESS" ? 0.05 : 0) + 0.15 * qSol;
  note(feasibility, "Already operating, with a team in place", "Early idea with little evidence it can be delivered yet");

  // Scalability (25%): target market breadth, reach so far, growth plans.
  const reach = Math.max(im.communitiesReached || 0, 0);
  const scalability = 0.4 * textQuality(b.targetMarket, 80) + 0.2 * logScale(reach, 50) + 0.15 * logScale(b.customersServed || 0, 2000)
    + (has(`${b.targetMarket} ${b.solution} ${b.description}`, SCALE_WORDS) ? 0.15 : 0) + 0.1 * (STAGE_LEVEL[b.stage] ?? 0);
  note(scalability, "Credible route to grow beyond the first market", "No clear plan to grow beyond the first location");

  // Social & environmental impact (10%): reach, jobs, inclusion, environment.
  const inclusion = (a.applicant.gender === "FEMALE" ? 0.05 : 0) + (a.inclusion.rural ? 0.05 : 0) + (a.inclusion.disability === "YES" ? 0.05 : 0);
  const impact = 0.2 * logScale(im.farmersReached || 0, 5000) + 0.15 * logScale(im.jobsCreated || 0, 50)
    + 0.1 * logScale((im.womenReached || 0) + (im.youthReached || 0), 2000) + 0.1 * Math.min(1, (im.agriImpactAreas?.length || 0) / 3)
    + 0.25 * textQuality(`${im.socialImpact} ${im.environmentalImpact} ${im.beneficiaries}`, 150) + inclusion;
  note(impact, "Measurable benefit to farmers and communities", "Impact is stated but not described or measured");

  // Market potential (10%): revenue, customers, who pays.
  const market = (b.generatesRevenue ? 0.15 : 0) + 0.3 * (REVENUE_LEVEL[b.revenueRange] ?? 0) + 0.2 * logScale(b.customersServed || 0, 2000)
    + 0.25 * textQuality(`${b.mainCustomers} ${b.revenueSource}`, 80) + 0.1 * textQuality(b.targetMarket, 80);
  note(market, "Paying customers and revenue already", "No paying customers or revenue yet");

  // Plausibility: very large claims from an idea-stage business need a person to check them.
  if (b.stage === "IDEA" && ((im.farmersReached || 0) > 2000 || (im.jobsCreated || 0) > 50 || (b.customersServed || 0) > 5000))
    flags.push("Large reach figures for an idea-stage business: check the claims");
  if (b.generatesRevenue === false && (REVENUE_LEVEL[b.revenueRange] ?? 0) > 0) flags.push("Says no revenue but chose a revenue range");

  const scores: Record<CriterionId, number> = { originality: to10(originality), feasibility: to10(feasibility), scalability: to10(scalability), impact: to10(impact), market: to10(market) };
  return { scores, strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 3), flags };
}

export const weightedOf = (s: Record<string, number>) =>
  Math.round(DEFAULT_CRITERIA.filter((c) => c.active).reduce((t, c) => t + ((s[c.id] ?? 0) / c.maximumScore) * c.weight, 0) * 100) / 100;

/** Pre-screens every application. Duplicate applicants: the best-scoring entry stays, the others are marked. */
export function preScreen(applications: Application[]): PreScore[] {
  const submitted = applications.filter((a) => a.submissionStatus !== "DRAFT");
  // Identical core answers (40+ words) in two or more applications = possible copying.
  const textKey = (a: Application) => norm(`${a.business.problem} ${a.business.solution}`);
  const textCount = new Map<string, number>();
  for (const a of submitted) { const k = textKey(a); if (k.split(" ").length >= 40) textCount.set(k, (textCount.get(k) ?? 0) + 1); }

  const out = submitted.map((a): PreScore => {
    const reasons = checkEligibility(a);
    const s = score(a, (textCount.get(textKey(a)) ?? 0) > 1);
    return { applicationId: a.applicationId, eligible: reasons.length === 0, ineligibleReasons: reasons, flags: s.flags, scores: s.scores,
      total: weightedOf(s.scores), strengths: s.strengths, weaknesses: s.weaknesses, duplicateOf: null };
  });

  // Same person twice: same email, or same phone and surname. Keep the strongest; earlier submission wins a tie.
  const byId = new Map(submitted.map((a) => [a.applicationId, a]));
  const groups = new Map<string, PreScore[]>();
  for (const p of out) {
    const a = byId.get(p.applicationId)!;
    const keys = [`e:${a.applicant.email.trim().toLowerCase()}`];
    const ph = normPhone(a.applicant.phone); if (ph.length >= 10) keys.push(`p:${ph}|${a.applicant.lastName.trim().toLowerCase()}`);
    for (const k of keys) { const g = groups.get(k) ?? []; g.push(p); groups.set(k, g); }
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const keep = [...g].sort((x, y) => Number(y.ineligibleReasons.length === 0) - Number(x.ineligibleReasons.length === 0) || y.total - x.total || (byId.get(x.applicationId)!.submittedAt ?? "").localeCompare(byId.get(y.applicationId)!.submittedAt ?? ""))[0];
    for (const p of g) if (p !== keep && !p.duplicateOf) {
      p.duplicateOf = keep.applicationId; p.eligible = false; p.ineligibleReasons.push(`Same applicant as ${keep.applicationId} (kept the stronger entry)`);
    }
  }
  return out;
}

/** Higher total first; ties by the framework order (originality, scalability, feasibility), then earlier submission. */
export function rankEligible(scored: PreScore[], applications: Application[]): PreScore[] {
  const at = new Map(applications.map((a) => [a.applicationId, a.submittedAt ?? ""]));
  return scored.filter((p) => p.eligible).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    for (const k of TIE_BREAK_ORDER) if (b.scores[k] !== a.scores[k]) return b.scores[k] - a.scores[k];
    return (at.get(a.applicationId) ?? "").localeCompare(at.get(b.applicationId) ?? "") || a.applicationId.localeCompare(b.applicationId);
  });
}

// ───────────── review batch with a fair spread ─────────────
export interface SpreadPick { applicationId: string; rank: number; via: string }
type Group = { label: string; test: (a: Application) => boolean; min: number };

/**
 * Takes `size` from the ranked shortlist. First it guarantees minimum places so no group is shut out
 * (every state present gets 1; each zone and value chain keeps `spreadFloor` of its shortlist share;
 * women and rural applicants reach the internal targets when there are enough of them), always choosing the
 * highest-ranked person who fills the gap. The remaining places go strictly by rank.
 */
export function pickWithSpread(ranked: PreScore[], applications: Application[], size: number): { picks: SpreadPick[]; groups: { label: string; min: number; got: number; available: number }[] } {
  const apps = new Map(applications.map((a) => [a.applicationId, a]));
  const pool = ranked.map((p, i) => ({ p, a: apps.get(p.applicationId)!, rank: i + 1 })).filter((x) => x.a);
  const n = Math.min(size, pool.length);
  const share = (test: (a: Application) => boolean) => pool.filter((x) => test(x.a)).length;
  const groups: Group[] = [];
  for (const s of new Set(pool.map((x) => x.a.location.state))) groups.push({ label: `State: ${s}`, test: (a) => a.location.state === s, min: 1 });
  for (const z of new Set(pool.map((x) => zoneOf(x.a.location.state)))) { const t = (a: Application) => zoneOf(a.location.state) === z; groups.push({ label: `Zone: ${z}`, test: t, min: Math.floor(SCREENING.spreadFloor * n * share(t) / pool.length) }); }
  for (const v of new Set(pool.map((x) => x.a.business.valueChain))) { const t = (a: Application) => a.business.valueChain === v; groups.push({ label: `Value chain: ${v}`, test: t, min: Math.floor(SCREENING.spreadFloor * n * share(t) / pool.length) }); }
  if (SCREENING.useInclusionTargets) {
    groups.push({ label: "Women", test: (a) => a.applicant.gender === "FEMALE", min: Math.ceil(n * TARGETS.femalePct / 100) });
    groups.push({ label: "Rural", test: (a) => a.inclusion.rural, min: Math.ceil(n * TARGETS.ruralPct / 100) });
  }
  const chosen = new Map<string, SpreadPick>();
  for (const g of groups) {
    const want = Math.min(g.min, share(g.test));
    let got = [...chosen.values()].filter((c) => g.test(apps.get(c.applicationId)!)).length;
    for (const x of pool) {
      if (got >= want || chosen.size >= n) break;
      if (chosen.has(x.p.applicationId) || !g.test(x.a)) continue;
      chosen.set(x.p.applicationId, { applicationId: x.p.applicationId, rank: x.rank, via: g.label }); got++;
    }
  }
  for (const x of pool) { if (chosen.size >= n) break; if (!chosen.has(x.p.applicationId)) chosen.set(x.p.applicationId, { applicationId: x.p.applicationId, rank: x.rank, via: "Rank" }); }
  // Anyone inside the top n by rank would have been picked anyway: label them "Rank", so "via spread" means a real change.
  const picks = [...chosen.values()].map((c) => (c.rank <= n ? { ...c, via: "Rank" } : c)).sort((a, b) => a.rank - b.rank);
  const picked = new Set(picks.map((p) => p.applicationId));
  const report = groups.filter((g) => g.min > 1 || g.label.startsWith("Zone") || g.label.startsWith("Value"))
    .map((g) => ({ label: g.label, min: Math.min(g.min, share(g.test)), got: pool.filter((x) => picked.has(x.p.applicationId) && g.test(x.a)).length, available: share(g.test) }));
  return { picks, groups: report };
}
