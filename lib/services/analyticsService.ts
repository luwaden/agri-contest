import { getRepository } from "@/lib/repository";
import { demoApplications } from "@/lib/demo";
import { computeAnalytics } from "@/lib/analytics/compute";
import { filterApplications, type ApplicationFilters } from "@/lib/analytics/filters";
import type { Application } from "@/types/application";

const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
const all = async (): Promise<Application[]> => (isDemo() ? demoApplications() : getRepository().getApplications());
const submittedOnly = (a: Application[]) => a.filter((x) => x.submissionStatus !== "DRAFT");

/** Controlled query layer: the rest of the app (and the AI context builder) read applicants only through these functions. */
export async function getApplicantStatistics(f: ApplicationFilters = {}) { return computeAnalytics(filterApplications(await all(), f), isDemo() ? 0 : await getRepository().countDrafts()); }
export async function getApplicantsByState(f: ApplicationFilters = {}) { return computeAnalytics(filterApplications(await all(), f)).states; }
export async function getApplicationAnalytics(f: ApplicationFilters = {}) { return computeAnalytics(filterApplications(await all(), f)); }
export async function getApplicationSummary(f: ApplicationFilters = {}) {
  const a = computeAnalytics(filterApplications(await all(), f));
  return { total: a.total, topStates: a.states.slice(0, 5), focal: a.focal, zones: a.zones, gender: { female: a.demographics.female, male: a.demographics.male }, valueChain: a.business.valueChain };
}
/** Minimal, non-identifying rows. Anything richer must be requested through an authorised admin page. */
export async function getFilteredApplicantData(f: ApplicationFilters = {}) {
  return filterApplications(submittedOnly(await all()), f).map((a) => ({ state: a.location.state, locationGroup: a.location.locationGroup, gender: a.applicant.gender, valueChain: a.business.valueChain, stage: a.business.stage, status: a.submissionStatus, score: a.score }));
}
export const getAllApplications = all;
