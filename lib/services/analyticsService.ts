import { getRepository } from "@/lib/repository";
import { demoApplications } from "@/lib/demo";
import { computeAnalytics } from "@/lib/analytics/compute";
import { filterApplications, type ApplicationFilters } from "@/lib/analytics/filters";
import type { Application } from "@/types/application";
import { countDrafts } from "./draftService";

const isDemo = () => process.env.NEXT_PUBLIC_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
/**
 * Admin screens re-query on every filter change. A short per-instance cache keeps them fast and protects the Sheets quota.
 * Screens that ask at the same moment share one download. If Google does not answer, a copy up to 10 minutes old is used
 * (and logged) rather than failing the page.
 */
// Kept on globalThis so every part of the app shares ONE copy (also under `next dev`, which loads modules per route).
type AppCache = { cache: { at: number; rows: Application[] } | null; loading: Promise<Application[]> | null };
const g: AppCache = ((globalThis as { __agraApps?: AppCache }).__agraApps ??= { cache: null, loading: null });
const TTL_MS = (Number(process.env.ADMIN_CACHE_SECONDS) || 60) * 1000;
const STALE_OK_MS = 10 * 60_000;
export const invalidateAdminCache = () => { g.cache = null; g.loading = null; };
const all = async (): Promise<Application[]> => {
  if (isDemo()) return demoApplications();
  if (g.cache && Date.now() - g.cache.at < TTL_MS) return g.cache.rows;
  let p = g.loading;
  if (!p) {
    const q: Promise<Application[]> = getRepository().getApplications().then((rows) => { if (g.loading === q) g.cache = { at: Date.now(), rows }; return rows; });
    const done = () => { if (g.loading === q) g.loading = null; };
    q.then(done, done);
    g.loading = p = q;
  }
  try { return await p; }
  catch (e) {
    if (g.cache && Date.now() - g.cache.at < STALE_OK_MS) {
      console.warn(`[applications] Google Sheets did not answer (${String((e as Error)?.message ?? e).slice(0, 120)}). Using the copy from ${Math.round((Date.now() - g.cache.at) / 1000)} s ago.`);
      return g.cache.rows;
    }
    throw e;
  }
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
