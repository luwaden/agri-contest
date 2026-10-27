/**
 * LEVEL 2 REVIEW: what a reviewer answers for each Level 2 applicant. Kept short on purpose.
 * Five questions scored 1–5 (total out of 25), one decision, one short comment.
 * Column order in the "Level 2 Reviews" tab follows L2_REVIEW_QUESTIONS: add new questions at the END only.
 */
export const L2_REVIEW_QUESTIONS = [
  { id: "operating", label: "The business is real and operating", hint: "Years running, staff, farmers served, and how consistent the answers are." },
  { id: "documents", label: "The documents back up the application", hint: "Proposal, pitch deck or EOP, and certificates where claimed. Can you open and read them?" },
  { id: "needs", label: "The support needs are clear and realistic", hint: "Finance, market, business or technical support that fits this business." },
  { id: "growth", label: "It can grow with the programme's support", hint: "A sensible next step that support would unlock." },
  { id: "reach", label: "It reaches farmers and includes others", hint: "Farmers served, rural reach, and women, youth or people with disability." },
] as const;
export type L2QuestionId = (typeof L2_REVIEW_QUESTIONS)[number]["id"];
export const L2_QUESTION_IDS = L2_REVIEW_QUESTIONS.map((q) => q.id) as L2QuestionId[];

/** The meaning of each score, shown under the buttons. */
export const L2_SCALE = ["", "Very weak", "Weak", "Fair", "Good", "Strong"] as const;
export const L2_MAX_TOTAL = L2_REVIEW_QUESTIONS.length * 5;

export const L2_DECISIONS = [
  { value: "RECOMMEND", label: "Recommend" },
  { value: "NOT_RECOMMEND", label: "Do not recommend" },
] as const;
export type L2Decision = (typeof L2_DECISIONS)[number]["value"];
