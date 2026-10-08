import { getRepository } from "@/lib/repository";
import { demoApplications } from "@/lib/demo";
import { computeAnalytics } from "@/lib/analytics/compute";
import { filterApplications, type ApplicationFilters } from "@/lib/analytics/filters";
import type { Application } from "@/types/application";
import { countDrafts } from "./draftService";

const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
/** Admin screens re-query on every filter change. A short per-instance cache keeps them fast and protects the Sheets quota. */
let cache: { at: number; rows: Application[] } | null = null;
const TTL_MS = (Number(process.env.ADMIN_CACHE_SECONDS) || 15) * 1000;
export const invalidateAdminCache = () => { cache = null; };
const all = async (): Promise<Application[]> => {
  if (isDemo()) return demoApplications();
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const rows = await getRepository().getApplications();
  cache = { at: Date.now(), rows }; return rows;
};
const submittedOnly = (a: Application[]) => a.filter((x) => x.submissionStatus !== "DRAFT");

/** Controlled query layer: the rest of the app (and the AI context builder) read applicants only through these functions. */
export async function getApplicantStatistics(f: ApplicationFilters = {}) { return computeAnalytics(filterApplications(await all(), f), isDemo() ? 0 : await countDrafts()); }
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
