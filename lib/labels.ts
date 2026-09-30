import { APPLICANT_ROLES, BUSINESS_STAGES, DISABILITY_OPTIONS, DISABILITY_TYPES, GENDERS, REGISTRATION_STATUSES, REVENUE_RANGES, SETTINGS, SUPPORT_NEEDS, VALUE_CHAINS, AGRI_IMPACT_AREAS, DOCUMENT_KINDS } from "@/config/programme";

type Opts = ReadonlyArray<{ value: string; label: string }>;
const make = (o: Opts) => (v?: string) => o.find((x) => x.value === v)?.label ?? v ?? "";
export const genderLabel = make(GENDERS);
export const valueChainLabel = make(VALUE_CHAINS);
export const stageLabel = make(BUSINESS_STAGES);
export const roleLabel = make(APPLICANT_ROLES);
export const registrationLabel = make(REGISTRATION_STATUSES);
export const revenueLabel = make(REVENUE_RANGES);
export const disabilityLabel = make(DISABILITY_OPTIONS);
export const disabilityTypeLabel = make(DISABILITY_TYPES);
export const settingLabel = make(SETTINGS);
export const supportLabel = make(SUPPORT_NEEDS);
export const agriImpactLabel = make(AGRI_IMPACT_AREAS);
export const documentLabel = make(DOCUMENT_KINDS);
export const groupLabel = (g: string) => (g === "FOCAL_STATES" ? "Focal states" : "Other states");

export const formatDate = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "—";
export const formatDateTime = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(iso)) : "—";
export const formatPct = (p: number | null) => (p === null ? "No data yet" : `${p}%`);
