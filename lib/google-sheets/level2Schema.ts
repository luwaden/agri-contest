import type { Level2Application } from "@/types/level2";

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
