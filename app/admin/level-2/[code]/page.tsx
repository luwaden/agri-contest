import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { PortalShell } from "@/components/admin/PortalShell";
import { requirePagePermission } from "@/lib/auth/server";
import { level2Documents, level2Submission } from "@/lib/services/level2Service";
import { l2AnswerSections } from "@/lib/level2/present";
import { reviewFor } from "@/lib/services/level2ReviewService";
import { L2_DECISIONS, L2_MAX_TOTAL, L2_REVIEW_QUESTIONS, L2_SCALE } from "@/config/level2Review";

export const metadata: Metadata = { title: "Level 2 submission", robots: { index: false } };
export const dynamic = "force-dynamic";


function Section({ title, rows }: { title: string; rows: Array<[string, React.ReactNode]> }) {
  return (
    <section className="break-inside-avoid rounded-lg border border-paper-line bg-white">
      <h2 className="border-b border-paper-line px-5 py-3 font-display text-lg font-extrabold">{title}</h2>
      <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-[240px_1fr]">
        {rows.map(([k, v]) => <Fragment key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="whitespace-pre-wrap break-words text-[15px] text-forest-900">{v === "" || v == null ? "—" : v}</dd></Fragment>)}
      </dl>
    </section>
  );
}

/** One Level 2 submission, read-only. Uploaded files open through the signed-in viewer (permission checked, each view logged). */
export default async function Level2Submission({ params }: { params: Promise<{ code: string }> }) {
  await requirePagePermission("applications:view");
  const { code } = await params;
  const s = await level2Submission(decodeURIComponent(code));
  if (!s) notFound();
  const docs = level2Documents(s);
  const review = await reviewFor(s.level1Code).catch(() => null);   // no Level 2 Reviews tab yet: shown as "no reviewer"
  const received = new Date(s.submittedAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <PortalShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/admin/level-2" className="text-sm font-semibold text-primary hover:underline">← Level 2 submissions</Link>
          <h1 className="mt-2 font-display text-3xl font-extrabold">{s.businessName || "Level 2 submission"}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            <span className="font-mono">{s.level1Code}</span> · {s.contactName} · received {received} WAT ·{" "}
            <Link href={`/admin/applications/${s.level1Code}`} className="font-semibold text-primary hover:underline">Level 1 application</Link>
          </p>
        </div>

        <section aria-labelledby="docs-h" className="rounded-lg border border-paper-line bg-white">
          <h2 id="docs-h" className="border-b border-paper-line px-5 py-3 font-display text-lg font-extrabold">Documents</h2>
          <ul className="divide-y divide-paper-line">
            {docs.map((d) => (
              <li key={d.field} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-forest-900">{d.label}</p>
                  <p className="text-sm text-ink-muted">{d.status === "missing" ? "Not provided" : d.source}</p>
                  {d.note && <p className="text-sm font-medium text-warn-fg">{d.note}</p>}
                </div>
                {d.status !== "missing" && (
                  <a href={d.href} target="_blank" rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-primary px-5 text-sm font-semibold text-primary hover:bg-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                    {d.status === "file" ? "Open" : "Open link"}<span className="sr-only">: {d.label}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="border-t border-paper-line px-5 py-3 text-xs text-ink-muted">Uploaded files open only for signed-in staff, and each opening is recorded in the activity log. Pasted links open the applicant's own sharing link.</p>
        </section>

        {review ? (
          <Section title="Review" rows={[
            ["Reviewer", review.reviewerName || review.reviewerEmail],
            ["Status", { ASSIGNED: "Not started", IN_PROGRESS: "Draft saved", SUBMITTED: `Submitted ${review.submittedAt ? new Date(review.submittedAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}`, WITHDRAWN: "Withdrawn" }[review.status]],
            ...L2_REVIEW_QUESTIONS.map((q): [string, string] => [q.label, review.scores[q.id] ? `${review.scores[q.id]} · ${L2_SCALE[review.scores[q.id]]}` : ""]),
            ["Total", review.total == null ? "" : `${review.total} / ${L2_MAX_TOTAL}`],
            ["Decision", review.decision ? L2_DECISIONS.find((d) => d.value === review.decision)!.label : ""],
            ["Comment", review.comment],
          ]} />
        ) : <p className="rounded-lg border border-dashed border-paper-line bg-white px-5 py-4 text-sm text-ink-muted">No reviewer yet. Assign one in <Link href="/admin/level-2/reviews" className="font-semibold text-primary hover:underline">Level 2 reviews</Link>.</p>}
        {l2AnswerSections(s).map((sec) => <Section key={sec.title} title={sec.title} rows={sec.rows} />)}
      </div>
    </PortalShell>
  );
}
