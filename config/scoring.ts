import type { ScoringCriterion } from "@/types/scoring";

/**
 * Default rubric. DRAFT ONLY: rankings must not be shown until programme
 * administrators confirm the official rubric (Batch 4 reads this from the Configuration sheet).
 */
export const DEFAULT_CRITERIA: ScoringCriterion[] = [
  { id: "originality", name: "Originality", description: "How different is the solution from existing ones?", maximumScore: 10, weight: 1, active: true },
  { id: "socialImpact", name: "Social impact", description: "Measurable change for people and communities.", maximumScore: 10, weight: 1, active: true },
  { id: "marketPotential", name: "Market potential", description: "Size and clarity of the market and customers.", maximumScore: 10, weight: 1, active: true },
  { id: "scalability", name: "Scalability", description: "Ability to grow without proportional cost.", maximumScore: 10, weight: 1, active: true },
  { id: "agriculturalRelevance", name: "Agricultural relevance", description: "Fit with maize, rice, soybean or allied value chains.", maximumScore: 10, weight: 1, active: true },
  { id: "inclusion", name: "Inclusion", description: "Reach to women, rural youth and persons with disabilities.", maximumScore: 10, weight: 1, active: true },
  { id: "feasibility", name: "Feasibility", description: "Credibility of delivery and the team.", maximumScore: 10, weight: 1, active: true },
];
