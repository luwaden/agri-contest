/**
 * LEVEL 2 APPLICATION (invited Level 1 applicants only). Wording and options as given by the programme team, 23 Oct 2026.
 * Questions that appeared twice in the brief are asked once: Name = "Name of contact person (Founder/CEO)", State once,
 * Rural/urban once. More questions are "still to come": add them at the END of LEVEL2_COLUMNS (lib/google-sheets/level2Schema.ts).
 */
export const LEVEL2 = {
  title: "Level 2 Application",
  intro: "This form is only for applicants invited to Level 2. Start with the Level 1 application code and the email address you used at Level 1.",
  /** Optional closing time (ISO, WAT). Empty = open while the invite list allows it. */
  closeDate: () => process.env.LEVEL2_CLOSE_DATE || "",
} as const;

const yn = [{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }] as const;
export const YES_NO = yn;
export const L2_SETTING = [{ value: "RURAL", label: "Rural" }, { value: "URBAN", label: "Urban" }] as const;
export const L2_DISABILITY = [{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }, { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" }] as const;
export const L2_CROPS = [{ value: "MAIZE", label: "Maize" }, { value: "RICE", label: "Rice" }, { value: "SOYBEAN", label: "Soybean" }, { value: "OTHER", label: "Other" }] as const;
export const L2_REGISTRATION = [
  { value: "SINGLE_PROPRIETOR", label: "Single proprietor" }, { value: "PARTNERSHIP", label: "Partnership" }, { value: "LIMITED_LIABILITY", label: "Limited liability" },
  { value: "COOPERATIVE", label: "Cooperative" }, { value: "NOT_APPLICABLE", label: "Not applicable" }, { value: "OTHER", label: "Other" },
] as const;
export const L2_GENDER = [{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }] as const;
export const L2_AGE = [{ value: "BELOW_29", label: "Below 29" }, { value: "29_35", label: "29 – 35" }, { value: "ABOVE_35", label: "Above 35" }] as const;
export const L2_EDUCATION = [
  { value: "UNIVERSITY", label: "University" }, { value: "COLLEGE", label: "College" }, { value: "SECONDARY", label: "Secondary school" },
  { value: "PRIMARY", label: "Primary school" }, { value: "NONE", label: "No formal education" },
] as const;
export const L2_NEEDS = [
  ["needFinance", "Does the SME need support with access to finance?"],
  ["needMarket", "Does the SME need support with access to market?"],
  ["needBds", "Does the SME need support with access to BDS (business development services)?"],
  ["needTechnical", "Does the SME need support with access to technical skills?"],
] as const;
/** Upload kinds for Level 2 (checked by the upload service). */
export const L2_DOC_KINDS = ["L2_SUPPORTING", "L2_SMEDAN", "L2_CAC", "L2_BANK"] as const;
