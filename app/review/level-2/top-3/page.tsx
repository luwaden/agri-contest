import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/server";
import { homeFor } from "@/lib/auth/permissions";
import { PanelShell } from "@/components/panel/PanelShell";
import { TopPicksForm } from "@/components/panel/TopPicksForm";
import { myLevel2Reviews, topPicksNeeded } from "@/lib/services/level2ReviewService";
import { featureOn } from "@/lib/features";

export const metadata: Metadata = { title: "My top 3", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The reviewer picks their best applicants (from the ones they have submitted) and says why. */
export default async function MyTopPicks() {
  const user = await requirePagePermission("scores:submit");
  if (user.role !== "REVIEWER" && user.role !== "JUDGE") redirect(homeFor(user.role));
  const items = await myLevel2Reviews(user).catch(() => []);
  const need = topPicksNeeded(items.length);
  const scored = items.filter((x) => x.review.status === "SUBMITTED" && x.review.percent !== null)
    .sort((a, b) => b.review.percent! - a.review.percent! || a.submission.businessName.localeCompare(b.submission.businessName))
    .map(({ review: r, submission: s }) => ({ code: s.level1Code, businessName: s.businessName, state: s.state, percent: r.percent!, decision: r.decision }));
  const current = items.filter((x) => x.review.topRank !== null).sort((a, b) => a.review.topRank! - b.review.topRank!)
    .map((x) => ({ code: x.submission.level1Code, reason: x.review.topReason }));
  const open = await featureOn("level2Scoring");

  return (
    <PanelShell user={user} notices={["level2Scoring"]}>
      <div className="mx-auto max-w-2xl space-y-6 pb-16">
        <div>
          <Link href="/review/level-2" className="text-sm font-semibold text-primary hover:underline">← My Level 2 reviews</Link>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-forest-900">Your top {need || 3}</h1>
          <p className="mt-1 text-sm text-ink-soft">Choose the strongest applicants you reviewed, best first, and say in a sentence or two why each one stands out. The programme team sees your picks next to everyone's scores.</p>
        </div>
        {need === 0 ? <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-ink-soft">No Level 2 applicants are assigned to you yet.</p>
          : scored.length < need ? <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-ink-soft">Submit at least {need} review{need === 1 ? "" : "s"} first. You have submitted {scored.length}.</p>
          : <TopPicksForm need={need} scored={scored} current={current} open={open} remaining={items.length - scored.length} />}
      </div>
    </PanelShell>
  );
}
