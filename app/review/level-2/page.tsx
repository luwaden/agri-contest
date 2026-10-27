import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/server";
import { homeFor } from "@/lib/auth/permissions";
import { PanelShell } from "@/components/panel/PanelShell";
import { myLevel2Reviews } from "@/lib/services/level2ReviewService";
import { L2_MAX_TOTAL } from "@/config/level2Review";

export const metadata: Metadata = { title: "Level 2 reviews", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS = { ASSIGNED: "Not started", IN_PROGRESS: "Draft saved", SUBMITTED: "Done", WITHDRAWN: "" } as const;

/** The reviewer's own Level 2 applicants: what is left first, then what is done. Nothing else. */
export default async function MyLevel2Reviews() {
  const user = await requirePagePermission("scores:submit");
  if (user.role !== "REVIEWER" && user.role !== "JUDGE") redirect(homeFor(user.role));
  const items = await myLevel2Reviews(user).catch(() => []);
  const left = items.filter((x) => x.review.status !== "SUBMITTED"), done = items.filter((x) => x.review.status === "SUBMITTED");
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;

  const List = ({ rows }: { rows: typeof items }) => (
    <ul className="divide-y divide-paper-line overflow-hidden rounded-lg border border-paper-line bg-white">
      {rows.map(({ review: r, submission: s }) => (
        <li key={r.reviewId}>
          <Link href={`/review/level-2/${s.level1Code}`} className="flex items-center gap-4 px-5 py-4 hover:bg-paper-warm/60 focus:outline-none focus-visible:bg-paper-warm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-forest-900">{s.businessName}</span>
              <span className="block truncate text-sm text-ink-muted">{s.state} · <span className="font-mono text-xs">{s.level1Code}</span></span>
            </span>
            <span className={`shrink-0 text-sm ${r.status === "SUBMITTED" ? "font-semibold text-primary" : r.status === "IN_PROGRESS" ? "text-ink-soft" : "text-ink-muted"}`}>
              {r.status === "SUBMITTED" && r.total != null ? `${r.total}/${L2_MAX_TOTAL} · ` : ""}{STATUS[r.status]}
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
            {left.length > 0 && <section className="mt-8" aria-labelledby="left-h"><h2 id="left-h" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">To review</h2><List rows={left} /></section>}
            {done.length > 0 && <section className="mt-8" aria-labelledby="done-h"><h2 id="done-h" className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Done</h2><List rows={done} /></section>}
          </>
        )}
      </div>
    </PanelShell>
  );
}
