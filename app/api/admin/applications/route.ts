import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth/server";
import { countDrafts } from "@/lib/services/draftService";
import { filterApplications, parseFilters } from "@/lib/analytics/filters";
import { computeAnalytics } from "@/lib/analytics/compute";
import { serverError } from "@/lib/http";
import { loadApplications } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireApiPermission("analytics:view");
  if ("error" in auth) return auth.error;
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    const { applications, demo } = await loadApplications();
    const filtered = filterApplications(applications, filters);
    return NextResponse.json({ demo, count: filtered.length, applications: filtered.map(toRow), analytics: computeAnalytics(filtered, demo ? 0 : await countDrafts()) });
  } catch (e) { return serverError(e); }
}

const toRow = (a: import("@/types/application").Application) => ({
  applicationId: a.applicationId, applicant: `${a.applicant.firstName} ${a.applicant.lastName}`, business: a.business.businessName,
  state: a.location.state, locationGroup: a.location.locationGroup, valueChain: a.business.valueChain, gender: a.applicant.gender,
  status: a.submissionStatus, submittedAt: a.submittedAt, score: a.score,
});
