import type { Metadata } from "next";
import Link from "next/link";
import { PortalShell } from "@/components/admin/PortalShell";
import { BatchCreator } from "@/components/admin/screening/BatchCreator";
import { AssignmentBoard } from "@/components/admin/screening/AssignmentBoard";
import { SendToJudges } from "@/components/admin/screening/SendToJudges";
import { ScreeningAssistant } from "@/components/admin/screening/ScreeningAssistant";
import { assistantExamples } from "@/lib/services/screeningAssistant";
import { requirePagePermission } from "@/lib/auth/server";
import { can } from "@/lib/auth/permissions";
import { board, summary } from "@/lib/services/screeningService";
import { results } from "@/lib/services/reviewService";
import { SCREENING } from "@/config/screening";

export const metadata: Metadata = { title: "Screening", robots: { index: false } };
export const dynamic = "force-dynamic";

const Step = ({ n, title, id, children, aside }: { n: number; title: string; id: string; children: React.ReactNode; aside?: React.ReactNode }) => (
  <section aria-labelledby={id} className="rounded-lg border border-paper-line bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <h2 id={id} className="flex items-baseline gap-3 font-display text-xl font-extrabold"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary text-sm text-primary">{n}</span>{title}</h2>
      {aside}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);
const Download = ({ list, size, label, rows }: { list: string; size?: number; label: string; rows?: number }) => (
  <a href={`/api/admin/screening/export?list=${list}${size ? `&size=${size}` : ""}`} className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white">
    {label}{rows != null ? <span className="tabular-nums opacity-70">({rows})</span> : null}</a>
);
const Stat = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => (
  <div className="rounded-lg border border-paper-line px-4 py-3"><dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
    <dd className="mt-0.5 font-display text-2xl font-extrabold tabular-nums">{value}</dd>{hint ? <dd className="text-xs text-ink-muted">{hint}</dd> : null}</div>
);

/**
 * The selection pipeline: all applications → eligible shortlist → review batch shared between reviewers →
 * reviewers pass their best → judges score them → finalists.
 */
export default async function ScreeningPage() {
  const user = await requirePagePermission("judges:manage");
  const mayExport = can(user.role, "export:data");
  let s: Awaited<ReturnType<typeof summary>>, rb: Awaited<ReturnType<typeof board>>, jb: Awaited<ReturnType<typeof board>>, judged: Awaited<ReturnType<typeof results>>;
  try { s = await summary(); rb = await board("REVIEWER"); jb = await board("JUDGE"); judged = await results("JUDGE"); }
  catch (e) {
    console.error("[screening] could not load:", String((e as Error)?.message ?? e).slice(0, 300));
    return <PortalShell><div role="alert" className="rounded-lg border border-danger-line bg-danger-bg p-6 text-danger-fg"><h1 className="font-display text-2xl font-extrabold">Screening could not load</h1><p className="mt-2">Google Sheets did not answer in time. Reload the page in a minute. If it keeps happening, run Admin → System check.</p></div></PortalShell>;
  }
  const limit = SCREENING.passPerReviewer;
  const scored = judged.filter((r) => r.average !== null);
  const waiting = judged.filter((r) => r.flags.includes("WAITING")).length;

  return (
    <PortalShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Screening</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-soft">
            From all applications to the finalists, in four steps. The pre-score is worked out automatically from each application&apos;s answers,
            using the same five criteria and weights as the judges. It puts applications in order; people make every selection decision.
          </p>
          {!mayExport && <p className="mt-2 text-sm text-warn-fg">Your role cannot download lists with personal data. Ask an administrator.</p>}
        </div>

        <section aria-labelledby="ask-h" className="rounded-lg border border-paper-line bg-white p-5">
          <h2 id="ask-h" className="font-display text-xl font-extrabold">Quick requests</h2>
          <p className="mb-3 mt-1 max-w-3xl text-sm text-ink-soft">Ask for a list in your own words, ask how many of a group are in a list, or ask to move work. You always see a preview first; nothing changes until you press Confirm.</p>
          <ScreeningAssistant examples={assistantExamples()} mayExport={mayExport} />
        </section>

        <Step n={1} id="s1" title={`Eligible applicants and the top ${SCREENING.shortlistSize.toLocaleString()}`}
          aside={mayExport ? <div className="flex flex-wrap gap-2"><Download list="shortlist" size={SCREENING.shortlistSize} label="Download top list" rows={s.shortlistSize} /><Download list="all" label="All, with reasons" rows={s.submitted} /></div> : null}>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Submitted" value={s.submitted.toLocaleString()} />
            <Stat label="Eligible" value={s.eligible.toLocaleString()} hint={`${s.ineligible.toLocaleString()} not eligible`} />
            <Stat label="Top list" value={s.shortlistSize.toLocaleString()} hint={s.cutOffScore != null ? `pre-score ${s.cutOffScore} and above` : undefined} />
            <Stat label="To check" value={s.flagged.toLocaleString()} hint="eligible, with a flag in the CSV" />
          </dl>
          {s.reasons.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Why {s.ineligible.toLocaleString()} are not eligible</summary>
            <ul className="mt-2 space-y-1">{s.reasons.map((r) => <li key={r.reason} className="flex justify-between gap-4 border-b border-paper-line py-1"><span>{r.reason}</span><span className="tabular-nums text-ink-muted">{r.count.toLocaleString()}</span></li>)}</ul>
            <p className="mt-2 text-xs text-ink-muted">An application can have more than one reason. Duplicates: {s.duplicates} (the stronger entry from the same person is kept).</p></details>}
        </Step>

        <Step n={2} id="s2" title={`Pick ${SCREENING.batchSize} and share them between the reviewers`}
          aside={mayExport && rb.inRound > 0 ? <Download list="batch" label="Download the batch" rows={rb.inRound} /> : null}>
          <p className="mb-4 max-w-3xl text-sm text-ink-soft">
            The batch is taken from the top of the list, but every state in the list keeps at least one place, each zone and value chain keeps at least half its share,
            and women and rural applicants reach the programme targets when there are enough of them. Everything else is strictly by pre-score.
            Running it again only adds what is missing; applications already with a reviewer stay where they are.
          </p>
          <BatchCreator reviewers={rb.people.map((p) => ({ email: p.email, name: p.name, assigned: p.assigned }))} shortlistDefault={SCREENING.shortlistSize} batchDefault={SCREENING.batchSize} />
        </Step>

        <Step n={3} id="s3" title={`Reviewers pass ${limit} each`}
          aside={mayExport && rb.passed > 0 ? <Download list="passed" label="Download passed" rows={rb.passed} /> : null}>
          <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="With reviewers" value={rb.inRound.toLocaleString()} />
            <Stat label="Passed so far" value={`${rb.passed} / ${limit * Math.max(1, rb.people.filter((p) => p.assigned > 0).length)}`} />
            <Stat label="Conflicts to move" value={rb.conflicts.length} />
          </dl>
          {rb.conflicts.length > 0 && <div className="mb-4 rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-fg">
            <p className="font-semibold">These were given back because of a conflict of interest. Use step 2 (Preview the batch) to give them to someone else.</p>
            <ul className="mt-1 list-disc pl-5">{rb.conflicts.slice(0, 10).map((c) => <li key={c.reviewId}>{c.businessName} ({c.applicationId}), {c.panelName}: “{c.note}”</li>)}</ul></div>}
          <p className="mb-3 text-sm text-ink-soft">Open a reviewer to see their list. To move work, tick applications, choose who gets them, and press Move. Passed or scored applications stay put.</p>
          <AssignmentBoard people={rb.people} passLimit={limit} role="REVIEWER" />
        </Step>

        <Step n={4} id="s4" title={`Judges choose the final ${SCREENING.finalists}`}
          aside={mayExport && scored.length > 0 ? <Download list="finalists" size={SCREENING.finalists} label={`Download top ${SCREENING.finalists}`} /> : null}>
          <SendToJudges passed={rb.passed} judges={jb.people.length} />
          {jb.inRound > 0 && <>
            <dl className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Stat label="With judges" value={jb.inRound} /><Stat label="Fully scored" value={scored.length - judged.filter((r) => r.average !== null && r.flags.includes("WAITING")).length} /><Stat label="Waiting for scores" value={waiting} />
            </dl>
            <AssignmentBoard people={jb.people} passLimit={null} role="JUDGE" />
            <p className="mt-3 text-sm">Ranking, ties and score spread are on <Link href="/admin/judging?round=judges" className="font-semibold text-primary underline">Judging → Judges → Results</Link>.</p>
          </>}
        </Step>
      </div>
    </PortalShell>
  );
}
