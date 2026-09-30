import type { Application } from "@/types/application";
import { locationGroupFor } from "@/lib/location";

export interface ApplicationFilters {
  state?: string; lga?: string; locationGroup?: string; gender?: string; disability?: string;
  setting?: string; valueChain?: string; stage?: string; status?: string;
  from?: string; to?: string; language?: string; q?: string;
}
export const FILTER_KEYS: Array<keyof ApplicationFilters> =
  ["state", "lga", "locationGroup", "gender", "disability", "setting", "valueChain", "stage", "status", "from", "to", "language", "q"];

export function parseFilters(params: Record<string, string | string[] | undefined> | URLSearchParams): ApplicationFilters {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : Array.isArray(params[k]) ? (params[k] as string[])[0] : (params[k] as string | undefined);
    return v ? String(v).slice(0, 100) : undefined;
  };
  const out: ApplicationFilters = {};
  for (const k of FILTER_KEYS) { const v = get(k); if (v) out[k] = v; }
  return out;
}

export function filterApplications(apps: Application[], f: ApplicationFilters): Application[] {
  const q = f.q?.toLowerCase();
  return apps.filter((a) => {
    // Grouping is derived from the state, never trusted from the stored column.
    if (f.state && a.location.state !== f.state) return false;
    if (f.lga && a.location.lga.toLowerCase() !== f.lga.toLowerCase()) return false;
    if (f.locationGroup && locationGroupFor(a.location.state) !== f.locationGroup) return false;
    if (f.gender && a.applicant.gender !== f.gender) return false;
    if (f.disability && a.inclusion.disability !== f.disability) return false;
    if (f.setting && (f.setting === "RURAL") !== a.inclusion.rural) return false;
    if (f.valueChain && a.business.valueChain !== f.valueChain) return false;
    if (f.stage && a.business.stage !== f.stage) return false;
    if (f.status && a.submissionStatus !== f.status) return false;
    const when = (a.submittedAt ?? a.metadata.createdAt).slice(0, 10);
    if (f.from && when < f.from) return false;
    if (f.to && when > f.to) return false;
    if (f.language && !a.languages.some((l) => l === f.language || l.startsWith(`${f.language}:`))) return false;
    if (q && !`${a.applicationId} ${a.applicant.firstName} ${a.applicant.lastName} ${a.business.businessName} ${a.applicant.email}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
