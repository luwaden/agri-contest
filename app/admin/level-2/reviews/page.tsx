import type { Metadata } from "next";
import Link from "next/link";
import { PortalShell } from "@/components/admin/PortalShell";
import { FeatureOffNotice } from "@/components/admin/FeatureOffNotice";
import { Level2Reviews } from "@/components/admin/level2/Level2Reviews";
import { requirePagePermission } from "@/lib/auth/server";
import { can } from "@/lib/auth/permissions";
import { level2ReviewOverview } from "@/lib/services/level2ReviewService";

export const metadata: Metadata = { title: "Level 2 reviews", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Assign Level 2 applicants to reviewers and follow their reviews. Administrators and coordinators. */
export default async function Level2ReviewsPage() {
  const user = await requirePagePermission("judges:manage");
  let data: Awaited<ReturnType<typeof level2ReviewOverview>>;
  try { data = await level2ReviewOverview(); }
  catch (e) {
    const missing = /does not exist/.test(String((e as Error)?.message));
    return <PortalShell><div role="alert" className="mx-auto max-w-3xl rounded-lg border border-danger-line bg-danger-bg p-6 text-danger-fg"><h1 className="font-display text-2xl font-extrabold">Level 2 reviews could not load</h1>
      <p className="mt-2">{missing ? "The “Level 2 Reviews” tab does not exist yet. Run npm run preflight, then npm run setup:sheets once (it only adds the new tab), then reload." : "Google Sheets did not answer in time. Reload the page in a minute."}</p></div></PortalShell>;
  }
  return (
    <PortalShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/admin/level-2" className="text-sm font-semibold text-primary hover:underline">← Level 2</Link>
          <h1 className="mt-2 font-display text-3xl font-extrabold">Level 2 reviews</h1>
          <p className="mt-1 text-sm text-ink-soft">Give each Level 2 applicant one reviewer. Reviewers see only their own applicants, without contact details.</p>
        </div>
        <FeatureOffNotice keys={["level2Scoring"]} settingsLink={can(user.role, "config:manage")} />
        <Level2Reviews data={data} mayExport={can(user.role, "export:data")} />
      </div>
    </PortalShell>
  );
}
