import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Fragment } from "react";
import { requirePagePermission } from "@/lib/auth/server";
import { homeFor } from "@/lib/auth/permissions";
import { PanelShell } from "@/components/panel/PanelShell";
import { Level2ReviewForm } from "@/components/panel/Level2ReviewForm";
import { myLevel2Reviews } from "@/lib/services/level2ReviewService";
import { level2Documents } from "@/lib/services/level2Service";
import { l2AnswerSectionsForReviewer, l2Facts } from "@/lib/level2/present";
import { featureOn } from "@/lib/features";

export const metadata: Metadata = { title: "Level 2 review", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One Level 2 applicant for its reviewer: read (facts, documents, all answers), then score. No contact details. */
export default async function ReviewLevel2({ params }: { params: Promise<{ code: string }> }) {
  const user = await requirePagePermission("scores:submit");
  if (user.role !== "REVIEWER" && user.role !== "JUDGE") redirect(homeFor(user.role));
  const code = decodeURIComponent((await params).code).toUpperCase();
  const all = await myLevel2Reviews(user).catch(() => []);
  const mine = all.find((x) => x.submission.level1Code === code);
  if (!mine) notFound();   // not assigned to this reviewer: same answer as "does not exist"
  const { submission: s, review: r } = mine;
  const next = all.find((x) => x.review.status !== "SUBMITTED" && x.submission.level1Code !== code);
  const docs = level2Documents(s).filter((d) => d.status !== "missing");
  const open = await featureOn("level2Scoring");
  const card = "rounded-lg border border-paper-line bg-white";

  return (
    <PanelShell user={user} notices={["level2Scoring"]}>
      <div className="mx-auto max-w-3xl space-y-6 pb-24 sm:pb-8">
        <div>
          <Link href="/review/level-2" className="text-sm font-semibold text-primary hover:underline">← My Level 2 reviews</Link>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-forest-900">{s.businessName}</h1>
          <p className="mt-1 text-sm text-ink-muted">{s.state} · <span className="font-mono">{s.level1Code}</span></p>
        </div>

        <section aria-labelledby="facts-h" className={card}>
          <h2 id="facts-h" className="border-b border-paper-line px-5 py-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">At a glance</h2>
          <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
            {l2Facts(s).map(([k, v]) => <div key={k}><dt className="text-xs text-ink-muted">{k}</dt><dd className="text-[15px] text-forest-900">{v || "—"}</dd></div>)}
          </dl>
        </section>

        <section aria-labelledby="docs-h" className={card}>
          <h2 id="docs-h" className="border-b border-paper-line px-5 py-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Documents</h2>
          {docs.length === 0 ? <p className="px-5 py-4 text-sm text-ink-muted">No documents were provided.</p> : (
            <ul className="divide-y divide-paper-line">
              {docs.map((d) => (
                <li key={d.field} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0 text-[15px] text-forest-900">{d.label}{d.status === "link" && <span className="block text-xs text-ink-muted">Link from the applicant</span>}</span>
                  <a href={d.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Open<span className="sr-only">: {d.label}</span></a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className={`${card} group`}>
          <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-primary marker:hidden"><span className="group-open:hidden">Show all answers</span><span className="hidden group-open:inline">Hide all answers</span></summary>
          {l2AnswerSectionsForReviewer(s).map((sec) => (
            <div key={sec.title} className="border-t border-paper-line px-5 py-4">
              <h3 className="text-sm font-semibold text-forest-900">{sec.title}</h3>
              <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-[220px_1fr]">
                {sec.rows.map(([k, v]) => <Fragment key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="whitespace-pre-wrap break-words text-sm text-forest-900">{v || "—"}</dd></Fragment>)}
              </dl>
            </div>
          ))}
        </details>

        <Level2ReviewForm code={s.level1Code} initial={{ scores: r.scores, decision: r.decision, comment: r.comment, status: r.status, total: r.total }} open={open}
          nextHref={next ? `/review/level-2/${next.submission.level1Code}` : null} />
      </div>
    </PanelShell>
  );
}
