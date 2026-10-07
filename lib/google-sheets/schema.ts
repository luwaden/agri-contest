import type { Application } from "@/types/application";
import { MENTOR_HEADERS } from "./mentorSchema";

export const SHEETS = {
  applications: "Applications",
  drafts: "Drafts",
  events: "Application Events",
  applicantMetrics: "Applicant Metrics",
  businessMetrics: "Business Metrics",
  inclusionMetrics: "Inclusion Metrics",
  stateMetrics: "State Metrics",
  mentors: "Mentors",
  adminUsers: "Admin Users",
  judges: "Judges",
  configuration: "Configuration",
} as const;

type Kind = "s" | "n" | "b" | "l" | "j";
interface Col { header: string; path: string; kind: Kind }

const c = (header: string, path: string, kind: Kind = "s"): Col => ({ header, path, kind });

/** STABLE HEADERS. Never rename or reorder existing columns once real data exists; only append. */
export const APPLICATION_COLUMNS: Col[] = [
  c("application_id", "applicationId"), c("created_at", "metadata.createdAt"), c("updated_at", "metadata.updatedAt"),
  c("submitted_at", "submittedAt"), c("status", "submissionStatus"), c("source", "metadata.source"),
  c("first_name", "applicant.firstName"), c("middle_name", "applicant.middleName"), c("last_name", "applicant.lastName"),
  c("gender", "applicant.gender"), c("date_of_birth", "applicant.dateOfBirth"), c("age", "applicant.age", "n"),
  c("phone", "applicant.phone"), c("whatsapp", "applicant.whatsapp"), c("email", "applicant.email"),
  c("nationality", "applicant.nationality"), c("address", "applicant.address"), c("community", "applicant.community"),
  c("state", "location.state"), c("lga", "location.lga"), c("location_group", "location.locationGroup"),
  c("disability", "inclusion.disability"), c("disability_type", "inclusion.disabilityType"),
  c("accessibility_needs", "inclusion.accessibilityNeeds"), c("residence_setting", "inclusion.residenceSetting"),
  c("rural", "inclusion.rural", "b"), c("languages", "languages", "l"),
  c("business_name", "business.businessName"), c("registration_status", "business.registrationStatus"),
  c("registration_number", "business.registrationNumber"), c("year_started", "business.yearStarted", "n"),
  c("business_state", "business.state"), c("business_lga", "business.lga"), c("business_address", "business.address"),
  c("business_setting", "business.setting"), c("website", "business.website"), c("social_handles", "business.socialHandles"),
  c("value_chain", "business.valueChain"), c("value_chain_other", "business.valueChainOther"),
  c("business_stage", "business.stage"), c("applicant_role", "business.applicantRole"), c("applicant_role_other", "business.applicantRoleOther"),
  c("business_description", "business.description"), c("problem", "business.problem"), c("solution", "business.solution"),
  c("originality", "business.originality"), c("innovation", "business.innovation"),
  c("main_customers", "business.mainCustomers"), c("target_market", "business.targetMarket"), c("customers_served", "business.customersServed", "n"),
  c("generates_revenue", "business.generatesRevenue", "b"), c("revenue_range", "business.revenueRange"), c("revenue_source", "business.revenueSource"),
  c("employees_full_time", "business.employees.fullTime", "n"), c("employees_part_time", "business.employees.partTime", "n"),
  c("employees_youth", "business.employees.youth", "n"), c("employees_women", "business.employees.women", "n"),
  c("farmers_reached", "impact.farmersReached", "n"), c("jobs_created", "impact.jobsCreated", "n"),
  c("women_reached", "impact.womenReached", "n"), c("youth_reached", "impact.youthReached", "n"),
  c("communities_reached", "impact.communitiesReached", "n"), c("people_benefited", "impact.peopleBenefited", "n"),
  c("social_impact", "impact.socialImpact"), c("beneficiaries", "impact.beneficiaries"),
  c("agri_impact_areas", "impact.agriImpactAreas", "l"), c("environmental_impact", "impact.environmentalImpact"),
  c("support_needs", "supportNeeds", "l"), c("support_needs_other", "supportNeedsOther"), c("programme_goal", "programmeGoal"),
  c("documents_json", "documents", "j"),
  c("declaration_accepted", "declaration.accepted", "b"), c("declaration_accepted_at", "declaration.acceptedAt"),
  c("score", "score", "n"),
];

export const HEADERS = {
  [SHEETS.applications]: APPLICATION_COLUMNS.map((x) => x.header),
  [SHEETS.drafts]: ["token_hash", "email", "updated_at", "stage", "payload_json"],
  [SHEETS.events]: ["at", "application_id", "actor", "action", "detail"],
  [SHEETS.mentors]: MENTOR_HEADERS,
  [SHEETS.adminUsers]: ["user_id", "name", "email", "role", "active", "note"],
  [SHEETS.judges]: ["judge_id", "name", "email", "active", "conflict_declared", "assigned_application_ids"],
  [SHEETS.configuration]: ["key", "value", "updated_at", "updated_by"],
} as const;

const get = (obj: any, path: string) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
function set(obj: any, path: string, value: unknown) {
  const keys = path.split(".");
  keys.slice(0, -1).reduce((o, k) => (o[k] ??= {}), obj)[keys[keys.length - 1]] = value;
}

const LIST_SEP = "; ";
/** Spreadsheet formula-injection guard: a leading = + - @ is neutralised on write and restored on read. */
const guard = (s: string) => (/^[=+\-@]/.test(s) ? `'${s}` : s);
const unguard = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

export function applicationToRow(app: Application): string[] {
  return APPLICATION_COLUMNS.map(({ path, kind }) => {
    const v = get(app, path);
    if (v == null) return "";
    switch (kind) {
      case "n": return String(v);
      case "b": return v ? "TRUE" : "FALSE";
      case "l": return guard((v as string[]).map((x) => x.replace(/;/g, ",")).join(LIST_SEP));
      case "j": return JSON.stringify(v);
      default: return guard(String(v));
    }
  });
}

export function rowToApplication(row: string[]): Application {
  const app: any = {};
  APPLICATION_COLUMNS.forEach(({ path, kind }, i) => {
    const raw = row[i] ?? "";
    let v: unknown;
    switch (kind) {
      case "n": v = raw === "" ? (path === "business.yearStarted" || path === "score" ? null : 0) : Number(raw); break;
      case "b": v = raw.toUpperCase() === "TRUE"; break;
      case "l": v = raw === "" ? [] : unguard(raw).split(LIST_SEP); break;
      case "j": try { v = raw ? JSON.parse(raw) : []; } catch { v = []; } break;
      default: v = unguard(raw);
    }
    if (path === "submittedAt" || path === "declaration.acceptedAt") v = raw === "" ? null : raw;
    set(app, path, v);
  });
  app.metadata.locationGroup = app.location.locationGroup;
  return app as Application;
}

/** 0-based column index → A1 letter(s). */
export const colLetter = (i: number) => {
  let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s;
};
export const columnLetterFor = (header: string) => colLetter(APPLICATION_COLUMNS.findIndex((x) => x.header === header));
