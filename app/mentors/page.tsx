import type { Metadata } from "next";
import { PageShell } from "@/components/landing/PageShell";
import { MentorApplicationForm } from "@/components/mentors/MentorApplicationForm";
import { BulletList, InfoCard, PrimaryCard } from "@/components/ui/cards";
import { Waves } from "@/components/landing/art";
import { Reveal } from "@/components/ui/motion";
import { PANEL_PAGE } from "@/config/mentors";

export const metadata: Metadata = {
  title: "Call for Experts: Mentors, Judges & Reviewers",
  description: "Share your experience with young agripreneurs. Apply to serve as a mentor, judge or reviewer for the AGRA–SMEDAN Youth Agri-Innovation Contest.",
  alternates: { canonical: "/mentors" },
};

export default function PanelPage() {
  return (
    <PageShell>
      <section className="grid-bg relative overflow-hidden bg-white">
        <Waves className="pointer-events-none absolute -right-32 -top-20 h-[560px] w-[560px]" />
        <div className="container-page relative py-14 sm:py-20">
          <p className="bubble inline-block rounded-2xl bg-azure px-5 py-2 text-base font-bold text-white">Call for Experts</p>
          <h1 className="mt-7 max-w-3xl font-display text-display-xl !font-extrabold text-primary">Mentors, judges <span className="text-azure">and reviewers.</span></h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-soft sm:text-xl">{PANEL_PAGE.intro}</p>
          <div className="mt-8"><a href="#panel-form" className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-base font-semibold text-white transition hover:bg-primary-800">Apply in 2 minutes</a></div>
        </div>
      </section>

      <section className="py-14 sm:py-20" aria-labelledby="roles-h">
        <div className="container-page">
          <h2 id="roles-h" className="sr-only">The three roles</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PANEL_PAGE.roles.map((r, i) => (
              <Reveal key={r.role} delay={i * 90}>
                <InfoCard tone={r.tone as "green" | "blue" | "yellow"} className="h-full" eyebrow={r.when} title={r.role}>{r.what}</InfoCard>
              </Reveal>
            ))}
          </div>
          <Reveal><div className="mt-4 grid gap-4 md:grid-cols-2">
            <PrimaryCard eyebrow="Ground rules" title="Fair and on the record"><div className="mt-2 text-white"><BulletList items={[...PANEL_PAGE.rules]} /></div></PrimaryCard>
            <InfoCard tone="light" eyebrow="Time" title={<span className="text-primary">Agreed with you</span>}>{PANEL_PAGE.commitment}</InfoCard>
          </div></Reveal>
        </div>
      </section>

      <section id="panel-form" className="scroll-mt-24 bg-paper-warm py-14 sm:py-20" aria-labelledby="form-h">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow">Application</p><h2 id="form-h" className="mt-3 font-display text-display-lg text-primary">A few short questions.</h2>
            <p className="mt-4 text-ink-soft">Eight answers and you are done. Fields marked <span className="text-danger-fg">*</span> are required. Your details are used only to assess your application and contact you.</p>
            <ol className="mt-6 space-y-2 text-sm text-ink-soft">{PANEL_PAGE.process.map(([t, d], i) => <li key={t}><strong className="text-primary">{i + 1}. {t}.</strong> {d}</li>)}</ol>
          </div>
          <div className="rounded-card border border-paper-line bg-white p-5 shadow-card sm:p-9"><MentorApplicationForm /></div>
        </div>
      </section>
    </PageShell>
  );
}
