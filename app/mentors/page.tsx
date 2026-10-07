import type { Metadata } from "next";
import { PageShell } from "@/components/landing/PageShell";
import { MentorApplicationForm } from "@/components/mentors/MentorApplicationForm";
import { BulletList, GreenCard, InfoCard, YellowCard } from "@/components/ui/cards";
import { Reveal } from "@/components/ui/motion";
import { MENTOR_PAGE } from "@/config/mentors";

export const metadata: Metadata = {
  title: "Call for Mentors",
  description: "Share your experience with young agripreneurs. Apply to become a mentor for the AGRA–SMEDAN Youth Agri-Innovation Contest.",
  alternates: { canonical: "/mentors" },
};

export default function MentorsPage() {
  return (
    <PageShell>
      <section className="bg-white">
        <div className="container-page relative py-14 sm:py-20">
          <p className="bubble inline-block rounded-2xl bg-azure px-5 py-2 text-base font-bold text-white">Call for Mentors</p>
          <h1 className="mt-7 max-w-3xl font-display text-display-xl !font-extrabold text-primary">Help the next generation of agripreneurs <span className="text-azure">grow.</span></h1>
          <p className="mt-4 max-w-2xl text-base text-ink-soft sm:text-lg">{MENTOR_PAGE.why}</p>
          <div className="mt-8"><a href="#mentor-form" className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white transition hover:bg-primary-800">Apply to be a mentor</a></div>
        </div>
      </section>

      <section className="py-14 sm:py-20" aria-labelledby="who-h">
        <div className="container-page grid gap-4 md:grid-cols-2">
          <Reveal><InfoCard tone="primary" className="h-full" eyebrow="Who can become a mentor" title={<span id="who-h">Experience that young founders can learn from</span>}><div className="mt-2 text-white"><BulletList items={[...MENTOR_PAGE.who]} /></div></InfoCard></Reveal>
          <Reveal delay={100}><GreenCard className="h-full" eyebrow="What we ask of mentors" title="Practical, honest, confidential"><div className="mt-2"><BulletList tone="onLight" items={[...MENTOR_PAGE.expectations]} /></div></GreenCard></Reveal>
          <Reveal><YellowCard className="h-full" eyebrow="Time commitment" title="Agreed with you">{MENTOR_PAGE.commitment}</YellowCard></Reveal>
          <Reveal delay={100}>
            <InfoCard tone="blue" className="h-full" eyebrow="Areas where you can contribute" title="Where mentors make a difference">
              <ul className="mt-1 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">{["Access to finance and investor readiness", "Business planning and strategy", "Marketing, sales and market access", "Operations and supply chain", "Crop production and agronomy", "Technology and innovation"].map((x) => <li key={x} className="flex gap-2"><span aria-hidden="true">•</span>{x}</li>)}</ul>
            </InfoCard>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-paper-line bg-white py-12 sm:py-16" aria-labelledby="process-h">
        <div className="container-page">
          <Reveal><p className="eyebrow">How mentoring works</p><h2 id="process-h" className="mt-3 font-display text-display-lg text-primary">Four simple steps.</h2></Reveal>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {MENTOR_PAGE.process.map(([t, d], i) => (
              <Reveal as="li" key={t} delay={i * 80}><span className="flex h-12 w-12 items-center justify-center rounded-full bg-sun font-display text-xl text-night">{i + 1}</span><h3 className="mt-4 font-display text-lg text-primary">{t}</h3><p className="mt-1 text-ink-soft">{d}</p></Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="mentor-form" className="scroll-mt-24 py-14 sm:py-20" aria-labelledby="form-h">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div><p className="eyebrow">Mentor application</p><h2 id="form-h" className="mt-3 font-display text-display-lg text-primary">Tell us about yourself.</h2><p className="mt-4 text-ink-soft">It takes about five minutes. Fields marked <span className="text-danger-fg">*</span> are required. Your details are used only to assess your application and contact you.</p></div>
          <div className="rounded-card border border-paper-line bg-white p-5 shadow-card sm:p-9"><MentorApplicationForm /></div>
        </div>
      </section>
    </PageShell>
  );
}
