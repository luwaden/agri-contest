import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/server";
import { homeFor } from "@/lib/auth/permissions";
import { PanelShell } from "@/components/panel/PanelShell";
import { myLevel2Reviews, topPicksNeeded } from "@/lib/services/level2ReviewService";
import { isLegacyL2Review } from "@/types/level2";

export const metadata: Metadata = { title: "Level 2 reviews", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS = { ASSIGNED: "Not started", IN_PROGRESS: "Draft saved", SUBMITTED: "Done", WITHDRAWN: "" } as const;

/** The reviewer's own Level 2 applicants: what is left first, then what is done, then their top 3. Nothing else. */
export default async function MyLevel2Reviews() {
  const user = await requirePagePermission("scores:submit");
  if (user.role !== "REVIEWER" && user.role !== "JUDGE") redirect(homeFor(user.role));
  const items = await myLevel2Reviews(user).catch(() => []);
  const isDone = (x: (typeof items)[number]) => x.review.status === "SUBMITTED" && !isLegacyL2Review(x.review);
  const left = items.filter((x) => !isDone(x)), done = items.filter(isDone).sort((a, b) => (b.review.percent ?? 0) - (a.review.percent ?? 0));
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;
  const need = topPicksNeeded(items.length);
  const picks = items.filter((x) => x.review.topRank !== null).sort((a, b) => a.review.topRank! - b.review.topRank!);

  const List = ({ rows }: { rows: typeof items }) => (
    <ul className="divide-y divide-paper-line overflow-hidden rounded-lg border border-paper-line bg-white">
      {rows.map(({ review: r, submission: s }) => (
        <li key={r.reviewId}>
          <Link href={`/review/level-2/${s.level1Code}`} className="flex items-center gap-4 px-5 py-4 hover:bg-paper-warm/60 focus:outline-none focus-visible:bg-paper-warm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-forest-900">{s.businessName}</span>
              <span className="block truncate text-sm text-ink-muted">{s.state} · <span className="font-mono text-xs">{s.level1Code}</span></span>
            </span>
            <span className={`shrink-0 text-sm tabular-nums ${isDone({ review: r, submission: s }) ? "font-semibold text-primary" : r.status === "IN_PROGRESS" ? "text-ink-soft" : "text-ink-muted"}`}>
              {isLegacyL2Review(r) ? "Mark again" : r.status === "SUBMITTED" && r.percent != null ? `${r.percent}%` : STATUS[r.status]}
              {r.topRank !== null && <span className="ml-2 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-semibold text-primary">Top {r.topRank}</span>}
            </span>
            <span aria-hidden="true" className="shrink-0 text-ink-muted">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <PanelShell user={user} notices={["level2Scoring"]}>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold text-primary">Level 2 reviews</h1>
        {items.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-ink-soft">No Level 2 applicants are assigned to you yet. They will appear here.</p>
        ) : (
          <>
            <div className="mt-4" aria-label={`${done.length} of ${items.length} done`}>
              <div className="flex justify-between text-sm text-ink-soft"><span>{left.length ? `${left.length} to review` : "All done. Thank you."}</span><span className="tabular-nums">{done.length} of {items.length} done</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-line"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
            </div>

            <section className="mt-8 rounded-lg border border-paper-line bg-white" aria-labelledby="top-h">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <h2 id="top-h" className="font-semibold text-forest-900">Your top {need}</h2>
                  <p className="text-sm text-ink-muted">
                    {picks.length ? `Chosen. You can change them until reviews close.` : done.length >= need ? `Choose the ${need} best applicants you reviewed and say why.` : `Available once you have submitted ${need} review${need === 1 ? "" : "s"} (${done.length} so far).`}
                  </p>
                </div>
                {done.length >= need && <Link href="/review/level-2/top-3" className="inline-flex min-h-[40px] items-center rounded-full border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{picks.length ? "Change" : "Choose"}</Link>}
              </div>
              {picks.length > 0 && (
                <ol className="divide-y divide-paper-line border-t border-paper-line">
                  {picks.map(({ review: r, submission: s }) => (
                    <li key={r.reviewId} className="flex items-baseline gap-3 px-5 py-3 text-sm">
                      <span className="w-5 shrink-0 font-semibold tabular-nums text-ink-muted">{r.topRank}.</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-forest-900">{s.businessName}</span>
                      <span className="shrink-0 tabular-nums text-ink-soft">{r.percent != null ? `${r.percent}%` : "Reopened"}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {left.length > 0 && <section className="mt-8" aria-labelledby="left-h"><h2 id="left-h" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">To review</h2><List rows={left} /></section>}
            {done.length > 0 && <section className="mt-8" aria-labelledby="done-h"><h2 id="done-h" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Done · highest score first</h2><List rows={done} /></section>}
          </>
        )}
      </div>
    </PanelShell>
  );
}
