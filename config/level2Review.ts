/**
 * LEVEL 2 REVIEW: the marking sheet a reviewer fills in for each Level 2 applicant.
 *
 *   Compulsory documents submitted ........ 5 marks each (4 documents = 20)
 *   Verified business registration ......... 10
 *   Verified bank account .................. 10
 *   Scalability ............................ 10
 *   Solid business planning evidence ....... 10
 *   Uniqueness of the solution ............. 20
 *                                            ── 80 marks, shown as a percentage (rounded to a whole number)
 *
 * Plus one decision (Recommend / Do not recommend) and a short comment.
 * Each reviewer then picks their top 3 applicants, with a reason for each.
 *
 * Sheet columns in the "Level 2 Reviews" tab follow L2_CRITERIA (`mark_<id>`): add new criteria at the END only, never rename an id.
 */
export interface L2Criterion {
  id: string;
  label: string;
  hint: string;
  max: number;
  /** Set for "document submitted" criteria: a document the applicant did not provide always scores 0. */
  doc?: "doc1" | "cacCertificate" | "smedanCertificate" | "bankProof";
}

export const L2_CRITERIA: readonly L2Criterion[] = [
  { id: "doc_proposal", label: "Business proposal, pitch deck or EOP", hint: "Submitted, opens, and is the right document.", max: 5, doc: "doc1" },
  { id: "doc_cac", label: "CAC certificate", hint: "Submitted, opens, and is the right document.", max: 5, doc: "cacCertificate" },
  { id: "doc_smedan", label: "SMEDAN certificate", hint: "Submitted, opens, and is the right document.", max: 5, doc: "smedanCertificate" },
  { id: "doc_bank", label: "Bank account proof", hint: "Submitted, opens, and is the right document.", max: 5, doc: "bankProof" },
  { id: "registration", label: "Verified business registration documentation", hint: "Names, numbers and dates match the business in the application.", max: 10 },
  { id: "bank_account", label: "Verified bank account", hint: "A business account in the business's name.", max: 10 },
  { id: "scalability", label: "Scalability", hint: "Can the business grow, reach more farmers or new markets with support?", max: 10 },
  { id: "planning", label: "Solid business planning evidence", hint: "Business Model Canvas, proposal, pitch deck: clear, realistic, numbers that add up.", max: 10 },
  { id: "uniqueness", label: "Uniqueness of the solution", hint: "How new or different it is from what is already available to farmers.", max: 20 },
];
export const L2_CRITERION_IDS = L2_CRITERIA.map((c) => c.id);
export const L2_MAX_MARKS = L2_CRITERIA.reduce((n, c) => n + c.max, 0);
/** Marks (out of L2_MAX_MARKS) as a whole-number percentage. */
export const l2Percent = (marks: number) => Math.round((marks / L2_MAX_MARKS) * 100);

/** Groups shown as headings on the marking sheet. */
export const L2_GROUPS = [
  { title: "Compulsory documents submitted", note: "5 marks each", ids: ["doc_proposal", "doc_cac", "doc_smedan", "doc_bank"] },
  { title: "Verification", note: "", ids: ["registration", "bank_account"] },
  { title: "The business", note: "", ids: ["scalability", "planning", "uniqueness"] },
] as const;

export const L2_DECISIONS = [
  { value: "RECOMMEND", label: "Recommend" },
  { value: "NOT_RECOMMEND", label: "Do not recommend" },
] as const;
export type L2Decision = (typeof L2_DECISIONS)[number]["value"];

/** How many applicants each reviewer picks as their best. */
export const L2_TOP_PICKS = 3;

/**
 * The first marking form (five questions, 1–5, out of 25). Kept ONLY because its columns already exist in the sheet:
 * old rows are still read and written back unchanged. Not used for new reviews.
 */
export const L2_LEGACY_QUESTION_IDS = ["operating", "documents", "needs", "growth", "reach"] as const;
export const L2_LEGACY_MAX = 25;
