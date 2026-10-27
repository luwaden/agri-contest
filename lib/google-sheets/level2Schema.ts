import type { Level2Application, Level2Review, Level2ReviewStatus } from "@/types/level2";
import { L2_CRITERIA, L2_CRITERION_IDS, L2_LEGACY_QUESTION_IDS, L2_TOP_PICKS, l2Percent } from "@/config/level2Review";

/**
 * STABLE HEADERS for the "Level 2 Applications" tab. Append new questions at the END only; never reorder.
 * One row per Level 1 code. Uploaded files are stored as links.
 */
export const LEVEL2_COLUMNS: Array<[header: string, key: keyof Level2Application]> = [
  ["level1_code", "level1Code"], ["submitted_at", "submittedAt"], ["level1_email", "level1Email"],
  ["business_name", "businessName"], ["year_established", "yearEstablished"], ["contact_name", "contactName"], ["phone", "phone"], ["email", "email"],
  ["state", "state"], ["lga", "lga"], ["community", "community"], ["rural_or_urban", "setting"],
  ["owner_gender", "ownerGender"], ["owner_age", "ownerAge"], ["disability", "disability"], ["owner_education", "ownerEducation"],
  ["crop_type", "cropType"], ["crop_type_other", "cropTypeOther"], ["has_cac", "hasCac"], ["registration_type", "registrationType"], ["registration_type_other", "registrationTypeOther"],
  ["permanent_employees", "permanentEmployees"], ["casual_employees", "casualEmployees"],
  ["trained_input_distribution", "trainedInputDistribution"], ["in_association", "inAssociation"], ["association_name", "associationName"],
  ["farmers_served_per_year", "farmersServed"], ["agra_support", "agraSupport"], ["business_bank_account", "hasBusinessBankAccount"],
  ["need_finance", "needFinance"], ["need_market", "needMarket"], ["need_bds", "needBds"], ["need_technical", "needTechnical"],
  ["has_other_needs", "hasOtherNeeds"], ["other_needs", "otherNeeds"],
  ["supporting_doc_1", "doc1"], ["supporting_doc_2", "doc2"], ["supporting_doc_3", "doc3"],
  ["smedan_certificate", "smedanCertificate"], ["cac_certificate", "cacCertificate"], ["bank_document", "bankProof"],
];
export const LEVEL2_HEADERS = LEVEL2_COLUMNS.map(([h]) => h);
export const LEVEL2_INVITE_HEADERS = ["level1_code", "invited_at", "invited_by", "note"];

const guard = (s: string) => (/^[=+\-@]/.test(s) ? `'${s}` : s);
const unguard = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);
export const level2ToRow = (a: Level2Application) => LEVEL2_COLUMNS.map(([, k]) => guard(String(a[k] ?? "")));
export function rowToLevel2(row: string[]): Level2Application | null {
  if (!row[0]) return null;
  return Object.fromEntries(LEVEL2_COLUMNS.map(([, k], i) => [k, unguard(row[i] ?? "")])) as unknown as Level2Application;
}

/**
 * "Level 2 Reviews" tab. Append new columns at the END only.
 * Columns 8–12 (score_operating … score_reach) and "total" belong to the first 5-question form: kept, read and written back unchanged.
 * The current marking sheet lives in the mark_* columns at the end, with marks_total (out of L2_MAX_MARKS) and percent.
 */
export const LEVEL2_REVIEW_HEADERS = [
  "review_id", "level1_code", "reviewer_email", "reviewer_name", "status", "assigned_at", "assigned_by",
  ...L2_LEGACY_QUESTION_IDS.map((id) => `score_${id}`), "total", "decision", "comment", "updated_at", "submitted_at",
  ...L2_CRITERION_IDS.map((id) => `mark_${id}`), "marks_total", "percent", "top_rank", "top_reason",
];
const L2_STATUSES: Level2ReviewStatus[] = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "WITHDRAWN"];
const LEG = L2_LEGACY_QUESTION_IDS.length;
const MARKS_AT = 12 + LEG;   // first mark_* column (0-based)
const intOrNull = (s: string) => { const v = Number(s); return s !== "" && Number.isInteger(v) ? v : null; };

export const level2ReviewToRow = (r: Level2Review): string[] => [
  r.reviewId, r.level1Code, guard(r.reviewerEmail), guard(r.reviewerName), r.status, r.assignedAt, guard(r.assignedBy),
  ...L2_LEGACY_QUESTION_IDS.map((id) => (Number.isInteger(r.legacy?.scores[id]) ? String(r.legacy!.scores[id]) : "")),
  r.legacy?.total == null ? "" : String(r.legacy.total), r.decision ?? "", guard(r.comment), r.updatedAt, r.submittedAt ?? "",
  ...L2_CRITERION_IDS.map((id) => (Number.isInteger(r.scores[id]) ? String(r.scores[id]) : "")),
  r.total === null ? "" : String(r.total), r.percent === null ? "" : String(r.percent),
  r.topRank === null ? "" : String(r.topRank), guard(r.topReason),
];
export function rowToLevel2Review(row: string[]): Level2Review | null {
  if (!row[0] || !row[1]) return null;
  const at = (i: number) => row[i] ?? "";
  const legacyScores: Record<string, number> = {};
  L2_LEGACY_QUESTION_IDS.forEach((id, i) => { const v = intOrNull(at(7 + i)); if (v !== null && v >= 1 && v <= 5) legacyScores[id] = v; });
  const legacyTotal = intOrNull(at(7 + LEG));
  const scores: Record<string, number> = {};
  L2_CRITERIA.forEach((c, i) => { const v = intOrNull(at(MARKS_AT + i)); if (v !== null && v >= 0 && v <= c.max) scores[c.id] = v; });
  const n = L2_CRITERIA.length;
  const total = intOrNull(at(MARKS_AT + n));
  const rank = intOrNull(at(MARKS_AT + n + 2));
  const status = L2_STATUSES.includes(at(4) as Level2ReviewStatus) ? (at(4) as Level2ReviewStatus) : "ASSIGNED";
  const decision = at(8 + LEG) === "RECOMMEND" || at(8 + LEG) === "NOT_RECOMMEND" ? (at(8 + LEG) as Level2Review["decision"]) : null;
  return { reviewId: row[0], level1Code: row[1].trim().toUpperCase(), reviewerEmail: unguard(at(2)).toLowerCase(), reviewerName: unguard(at(3)), status, assignedAt: at(5), assignedBy: unguard(at(6)),
    scores, total, percent: total === null ? null : l2Percent(total), decision, comment: unguard(at(9 + LEG)), updatedAt: at(10 + LEG), submittedAt: at(11 + LEG) || null,
    topRank: rank !== null && rank >= 1 && rank <= L2_TOP_PICKS ? rank : null, topReason: unguard(at(MARKS_AT + n + 3)),
    legacy: Object.keys(legacyScores).length || legacyTotal !== null ? { scores: legacyScores, total: legacyTotal } : null };
}
