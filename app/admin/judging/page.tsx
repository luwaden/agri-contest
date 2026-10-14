import type { Metadata } from "next";
import Link from "next/link";
import { PortalShell } from "@/components/admin/PortalShell";
import { AutoAssign } from "@/components/admin/judging/AutoAssign";
import { ResultsTable } from "@/components/admin/judging/ResultsTable";
import { FillGapButton } from "@/components/admin/judging/FillGapButton";
import { requirePagePermission } from "@/lib/auth/server";
import { overview, results } from "@/lib/services/reviewService";
import { ACTIVE_CRITERIA } from "@/lib/judging";
import { VALUE_CHAINS, NIGERIAN_STATES } from "@/config/programme";
import { isDemoMode } from "@/lib/data";
import { formatDate } from "@/lib/labels";
import type { PanelRole } from "@/types/review";

export const metadata: Metadata = { title: "Judging", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Assign applications to reviewers (screening) and judges, follow progress, resolve conflicts, and see results. */
export default async function JudgingPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  await requirePagePermission("judges:manage");
  const role: PanelRole = (await searchParams).round === "judges" ? "JUDGE" : "REVIEWER";
  let o: Awaited<ReturnType<typeof overview>>, rows: Awaited<ReturnType<typeof results>>;
  try { o = await overview(); rows = await results(role); }
  catch (e) {
    console.error("[judging] could not load:", e);
    return <PortalShell><div role="alert" className="rounded-lg border border-danger-line bg-danger-bg p-6 text-danger-fg"><h1 className="font-display text-2xl font-extrabold">Judging could not load</h1><p className="mt-2">The data store did not answer in time. Reload the page in a minute. If it keeps happening, run Admin → System check.</p></div></PortalShell>;
  }
  const people = o.byPerson.filter((p) => p.role === role);
  const liveFor = (id: string) => o.reviews.filter((r) => r.applicationId === id && r.panelRole === role && r.status !== "WITHDRAWN" && r.status !== "CONFLICT");
  // A conflict is resolved once someone new has been given that application after it was declared.
  const conflicts = o.conflicts.filter((c) => c.panelRole === role && !liveFor(c.applicationId).some((r) => r.assignedAt > c.updatedAt));
  const target = (id: string) => liveFor(id).length + 1;
  const word = role === "JUDGE" ? "judge" : "reviewer";
  const assignedApps = new Set(o.reviews.filter((r) => r.panelRole === role && r.status !== "WITHDRAWN").map((r) => r.applicationId)).size;
  const submitted = o.reviews.filter((r) => r.panelRole === role && r.status === "SUBMITTED").length;
  const live = o.reviews.filter((r) => r.panelRole === role && r.status !== "WITHDRAWN" && r.status !== "CONFLICT").length;

  return (
    <PortalShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="font-display text-3xl font-extrabold">Judging</h1>
            <p className="text-sm text-ink-soft">Give applications to {word}s, follow their progress and see the results. {word[0].toUpperCase() + word.slice(1)}s only ever see what is assigned to them.</p></div>
          <nav aria-label="Round" className="flex rounded-full border border-paper-line bg-white p-1 text-sm font-semibold">
            {[["reviewers", "Screening (reviewers)", "REVIEWER"], ["judges", "Judges", "JUDGE"]].map(([q, l, r]) => (
              <Link key={q} href={`/admin/judging?round=${q}`} aria-current={role === r ? "page" : undefined} className={`rounded-full px-4 py-1.5 ${role === r ? "bg-primary text-white" : "text-primary hover:bg-paper-warm"}`}>{l}</Link>
            ))}
          </nav>
        </div>

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[[`${word[0].toUpperCase() + word.slice(1)}s`, people.length], ["Applications assigned", assignedApps], ["Score sheets submitted", `${submitted} / ${live}`], ["Conflicts to resolve", conflicts.length]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border border-paper-line bg-white px-4 py-3"><dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{l}</dt><dd className="mt-0.5 font-display text-2xl font-extrabold tabular-nums">{v}</dd></div>
          ))}
        </dl>

        <section aria-labelledby="assign-h" className="rounded-lg border border-paper-line bg-white p-5">
          <h2 id="assign-h" className="font-display text-xl font-extrabold">Assign applications</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-soft">Choose which applications and how many {word}s each should have. You see a preview first. Work is shared evenly: the person with the fewest applications gets the next one. Nobody gets the same application twice, an application from their own email address, or one they declared a conflict on. Running it again only fills gaps, so it is safe to repeat after adding people or after a conflict.</p>
          {isDemoMode() ? <p className="mt-3 rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-fg">Demo mode: sample applications, but assignments are saved to the local test store.</p> : null}
          <div className="mt-4"><AutoAssign role={role} valueChains={VALUE_CHAINS.map((v) => ({ value: v.value, label: v.label }))} states={[...NIGERIAN_STATES]} /></div>
        </section>

        {conflicts.length > 0 && (
          <section aria-labelledby="coi-h" className="rounded-lg border border-warn-line bg-warn-bg p-5">
            <h2 id="coi-h" className="font-display text-xl font-extrabold text-warn-fg">Conflicts of interest to resolve ({conflicts.length})</h2>
            <p className="mt-1 text-sm text-warn-fg">These {word}s declared a relationship with the applicant and will not score the entry. Give each one to someone else.</p>
            <ul className="mt-3 divide-y divide-warn-line">
              {conflicts.map((c) => (
                <li key={c.reviewId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div><Link href={`/admin/applications/${c.applicationId}`} className="font-mono text-xs font-semibold underline">{c.applicationId}</Link> <strong>{c.businessName}</strong>
                    <p className="text-warn-fg">{c.panelName} ({c.panelEmail}) on {formatDate(c.updatedAt)}: “{c.conflictNote}”</p></div>
                  <FillGapButton role={role} applicationId={c.applicationId} target={target(c.applicationId)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="people-h">
          <h2 id="people-h" className="font-display text-xl font-extrabold">Progress by {word}</h2>
          {people.length === 0 ? <p className="mt-2 rounded-lg border border-dashed border-neutral-300 bg-white px-5 py-6 text-sm text-ink-soft">No {word}s yet. Add them on the <Link href="/admin/staff" className="font-semibold text-azure underline">Staff</Link> page with the role {role === "JUDGE" ? "Judge" : "Reviewer"}.</p> : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-paper-line bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-paper-warm text-left text-xs text-ink-muted"><tr>{["Name", "Email", "Assigned", "Not started", "In progress", "Submitted", "Conflicts", "Done"].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-paper-line">{people.map((p) => (
                  <tr key={p.email}><td className="px-3 py-2.5 font-semibold">{p.name}</td><td className="px-3 py-2.5 text-ink-soft">{p.email}</td>
                    {[p.assigned, p.notStarted, p.inProgress, p.submitted, p.conflicts].map((n, i) => <td key={i} className="px-3 py-2.5 tabular-nums">{n}</td>)}
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-paper-line"><div className="h-full bg-primary" style={{ width: `${p.assigned ? Math.round((p.submitted / p.assigned) * 100) : 0}%` }} /></div><span className="tabular-nums text-xs text-ink-muted">{p.assigned ? Math.round((p.submitted / p.assigned) * 100) : 0}%</span></div></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="results-h">
          <h2 id="results-h" className="font-display text-xl font-extrabold">Results</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-soft">Average of submitted score sheets only (a missing score is never counted as zero). Ties are ordered by originality, then scalability, then feasibility; anything still tied is marked for the moderation panel. Changing an application's status is still done by a person on the application page.</p>
          <div className="mt-3"><ResultsTable rows={rows} criteria={ACTIVE_CRITERIA.map((c) => ({ id: c.id, name: c.name }))} round={role === "JUDGE" ? "judges" : "reviewers"} /></div>
        </section>
      </div>
    </PortalShell>
  );
}
