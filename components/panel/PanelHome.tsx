import Link from "next/link";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { Wordmark } from "@/components/brand/Wordmark";
import { BulletList, GreenCard, InfoCard, YellowCard } from "@/components/ui/cards";
import { DEFAULT_CRITERIA, SCORE_BANDS } from "@/config/scoring";
import { roleLabel } from "@/lib/auth/permissions";
import type { SessionUser } from "@/types/user";

/** Landing page for judges and reviewers. They see only what is assigned to them (assignment arrives in the scoring release). */
export function PanelHome({ user }: { user: SessionUser }) {
  const reviewer = user.role === "REVIEWER";
  return (
    <main id="main" className="container-page max-w-4xl py-12 sm:py-16">
      <div className="mb-10 flex items-center justify-between gap-4"><Wordmark /><SignOutButton /></div>
      <p className="eyebrow">{roleLabel(user.role)} portal</p>
      <h1 className="mt-2 font-display text-display-lg text-primary">Welcome, {user.name}</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        {reviewer ? "Reviewers score entries against the published rubric in the screening rounds." : "Judges score entries against the published rubric, and take part in the finale."}
        {" "}You will only ever see applications that have been assigned to you.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <YellowCard eyebrow="Your assignments" title="None yet">Scoring has not opened. When it does, your assigned applications and the scoring form will appear here. You will be told by the programme team.</YellowCard>
        <GreenCard eyebrow="Before you score" title="Declare any conflict of interest">Do not score an entry from anyone with whom you have a personal, commercial, advisory or investment relationship. Tell the programme team and it will be reassigned.</GreenCard>
      </div>

      <section className="mt-12" aria-labelledby="rubric-h">
        <h2 id="rubric-h" className="font-display text-2xl text-primary">The scoring rubric</h2>
        <p className="mt-2 text-ink-soft">Each criterion is scored 1 to 10. The weights give a total out of 100.</p>
        <div className="mt-5 overflow-x-auto rounded-card border border-paper-line bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-primary text-left text-xs text-white"><tr><th className="px-4 py-3">Criterion</th><th className="px-4 py-3">Weight</th><th className="px-4 py-3">What you are assessing</th></tr></thead>
            <tbody className="divide-y divide-paper-line">{DEFAULT_CRITERIA.map((c) => <tr key={c.id} className="align-top"><td className="px-4 py-3 font-semibold text-primary">{c.name}</td><td className="px-4 py-3 tabular-nums">{c.weight}%</td><td className="px-4 py-3 text-ink-soft">{c.description}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="mt-6"><InfoCard tone="primary" eyebrow="Score bands" title="What the numbers mean"><div className="mt-2"><BulletList items={SCORE_BANDS.map((b) => `${b.min}–${b.max} ${b.band}: ${b.text}`)} /></div></InfoCard></div>
      </section>
      <p className="mt-10 text-sm text-ink-muted">Questions about the process? Use the <strong>Ask</strong> button at the bottom right of any page. <Link href="/" className="font-semibold text-azure underline">Back to the public site</Link></p>
    </main>
  );
}
