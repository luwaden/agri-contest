import { Suspense } from "react";
import { PanelShell } from "./PanelShell";
import { WorkList } from "./WorkList";
import { DEFAULT_CRITERIA, SCORE_BANDS } from "@/config/scoring";
import { roleLabel } from "@/lib/auth/permissions";
import { myWork } from "@/lib/services/reviewService";
import type { SessionUser } from "@/types/user";

/** Home of the judge and reviewer portals: progress, the filterable list of applications assigned to them, and the rubric. */
export async function PanelHome({ user }: { user: SessionUser }) {
  const items = await myWork(user);
  const count = (s: string) => items.filter((i) => i.review.status === s).length;
  const live = items.filter((i) => i.review.status !== "CONFLICT").length;
  const done = count("SUBMITTED");
  const pct = live ? Math.round((done / live) * 100) : 0;
  const base = user.role === "JUDGE" ? "/judge" : "/review";
  return (
    <PanelShell user={user}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{roleLabel(user.role)} portal</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-primary">Welcome, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 max-w-2xl text-ink-soft">
            {user.role === "REVIEWER" ? "Score each entry in the screening round against the rubric." : "Score each entry against the rubric."} You only ever see applications assigned to you, and nobody else sees your scores except the programme team.
          </p>
        </div>
        {live > 0 && (
          <div className="w-full max-w-xs" aria-label={`${done} of ${live} submitted`}>
            <div className="flex justify-between text-sm font-semibold text-primary"><span>Progress</span><span className="tabular-nums">{done} of {live} submitted</span></div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-paper-line"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["To score", count("ASSIGNED"), "bg-sun text-night"], ["In progress", count("IN_PROGRESS"), "bg-white text-primary"], ["Submitted", done, "bg-lime text-night"], ["Conflicts declared", count("CONFLICT"), "bg-white text-ink-soft"]].map(([l, n, c]) => (
          <div key={l as string} className={`rounded-tile border border-paper-line px-4 py-3 ${c}`}><dt className="text-xs font-semibold uppercase tracking-wide opacity-80">{l}</dt><dd className="mt-0.5 font-display text-3xl font-extrabold tabular-nums">{n}</dd></div>
        ))}
      </dl>

      <section className="mt-8" aria-labelledby="work-h">
        <h2 id="work-h" className="sr-only">Your assigned applications</h2>
        {items.length === 0 ? (
          <div className="rounded-card border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <p className="font-display text-xl font-extrabold text-primary">No applications assigned to you yet</p>
            <p className="mx-auto mt-2 max-w-lg text-ink-soft">The programme team assigns applications when the {user.role === "REVIEWER" ? "screening round" : "judging round"} opens. They will appear here, and you will be told. Meanwhile, read the scoring guide below.</p>
          </div>
        ) : <Suspense><WorkList items={items} base={base} /></Suspense>}
      </section>

      <section id="rubric" className="mt-12 scroll-mt-24" aria-labelledby="rubric-h">
        <h2 id="rubric-h" className="font-display text-2xl font-extrabold text-primary">Scoring guide</h2>
        <p className="mt-1 text-ink-soft">Score each criterion from 1 to 10. The weights turn your scores into a total out of 100. Judge only what the application shows.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-x-auto rounded-card border border-paper-line bg-white">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-primary text-left text-xs text-white"><tr><th className="px-4 py-3">Criterion</th><th className="px-4 py-3">Weight</th><th className="px-4 py-3">What you are assessing</th></tr></thead>
              <tbody className="divide-y divide-paper-line">{DEFAULT_CRITERIA.filter((c) => c.active).map((c) => <tr key={c.id} className="align-top"><td className="px-4 py-3 font-semibold text-primary">{c.name}</td><td className="px-4 py-3 tabular-nums">{c.weight}%</td><td className="px-4 py-3 text-ink-soft">{c.description}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="space-y-4">
            <div className="rounded-card border border-paper-line bg-white p-5">
              <h3 className="font-semibold text-primary">Score bands</h3>
              <ul className="mt-2 space-y-1.5 text-sm">{SCORE_BANDS.map((b) => <li key={b.band}><strong className="tabular-nums">{b.min}–{b.max} {b.band}:</strong> <span className="text-ink-soft">{b.text}</span></li>)}</ul>
            </div>
            <div className="rounded-card bg-lime p-5 text-night">
              <h3 className="font-semibold">Conflict of interest</h3>
              <p className="mt-1 text-sm">If you know the applicant personally, or have any commercial, advisory or investment link, do not score. Open the application and press <strong>Declare a conflict</strong>. The programme team will give it to someone else.</p>
            </div>
          </div>
        </div>
      </section>
    </PanelShell>
  );
}
