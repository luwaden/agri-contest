import type { ScoringCriterion } from "@/types/scoring";

/**
 * The evaluation rubric from the Contest Design Framework v1.0, section 6 (fixed by Attachment A, Task 3).
 * Each criterion is scored 1 to 10; `weight` is the percentage it contributes, so weights sum to 100 and the
 * weighted total is out of 100. Changing weights needs written agreement of the Project Implementing Team.
 *
 * NOTE (Jesnoch review, comment 7): the same rubric is used at every stage. The framework reviewer recommends
 * stage-specific guidance (Stage 1 = what can be seen; Stage 2 = evidence). That is a descriptor change, not a weight change.
 */
export const DEFAULT_CRITERIA: ScoringCriterion[] = [
  { id: "originality", name: "Originality", description: "Is this genuinely new in its market, or a meaningful improvement on what exists? Judged relative to the applicant's context.", maximumScore: 10, weight: 30, active: true },
  { id: "feasibility", name: "Feasibility", description: "Can this be built and operated by this applicant, with realistic resources and time? Is the applicant close enough to the problem?", maximumScore: 10, weight: 25, active: true },
  { id: "scalability", name: "Scalability", description: "Can this grow beyond its first location and customers? Does growth compound rather than cost proportionally more?", maximumScore: 10, weight: 25, active: true },
  { id: "impact", name: "Social & environmental impact", description: "Who benefits, how many, and how much? Does it reduce environmental harm or build climate resilience? Inclusion of women, rural and vulnerable groups.", maximumScore: 10, weight: 10, active: true },
  { id: "market", name: "Market potential", description: "Is there a paying customer, a defined market and a credible route to revenue?", maximumScore: 10, weight: 10, active: true },
];

/** Score bands (framework section 6.1). */
export const SCORE_BANDS = [
  { band: "Exceptional", min: 9, max: 10, text: "Distinctive and convincing. Evidence supports every substantive claim." },
  { band: "Strong", min: 7, max: 8, text: "Clear and well argued, with evidence behind the main claims. Minor gaps." },
  { band: "Adequate", min: 5, max: 6, text: "Sound idea but thinly evidenced, or a material gap. Promising, not yet demonstrated." },
  { band: "Weak", min: 3, max: 4, text: "Significant gaps in logic or evidence. Substantial further work required." },
  { band: "Insufficient", min: 1, max: 2, text: "The criterion is not meaningfully addressed, or the entry contradicts the claim." },
] as const;

/** Tie-break order (framework section 7.1): originality, then scalability, then feasibility, then moderation panel. */
export const TIE_BREAK_ORDER = ["originality", "scalability", "feasibility"] as const;
