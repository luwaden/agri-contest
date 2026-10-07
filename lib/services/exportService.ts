import { getRepository } from "@/lib/repository";
import { getAllApplications } from "./analyticsService";
import { filterApplications, type ApplicationFilters } from "@/lib/analytics/filters";
import { zoneOf } from "@/config/admin";
import { csvCell } from "@/lib/csv";

export const EXPORT_HEADERS = ["application_id", "status", "submitted_at", "first_name", "last_name", "email", "phone", "gender", "age", "state", "zone", "lga", "location_group", "rural", "disability", "business_name", "value_chain", "business_stage", "revenue_range", "jobs_created", "farmers_reached", "score"];

export async function buildApplicationsCsv(filters: ApplicationFilters, actor: string): Promise<{ csv: string; rows: number }> {
  const apps = filterApplications((await getAllApplications()).filter((a) => a.submissionStatus !== "DRAFT"), filters);
  const lines = apps.map((a) => [a.applicationId, a.submissionStatus, a.submittedAt, a.applicant.firstName, a.applicant.lastName, a.applicant.email, a.applicant.phone, a.applicant.gender, a.applicant.age, a.location.state, zoneOf(a.location.state), a.location.lga, a.location.locationGroup, a.inclusion.rural, a.inclusion.disability, a.business.businessName, a.business.valueChain, a.business.stage, a.business.revenueRange, a.impact.jobsCreated, a.impact.farmersReached, a.score ?? ""].map(csvCell).join(","));
  await getRepository().logEvent({ at: new Date().toISOString(), applicationId: "-", actor, action: "EXPORT", detail: `${apps.length} rows | filters=${JSON.stringify(filters).slice(0, 200)}` }).catch(() => undefined);
  return { csv: "\ufeff" + [EXPORT_HEADERS.join(","), ...lines].join("\r\n"), rows: apps.length };
}
