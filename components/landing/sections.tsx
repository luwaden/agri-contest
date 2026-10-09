import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/motion";
import { BlueCard, BulletList, GreenCard, InfoCard, ProgrammeStat, YellowCard } from "@/components/ui/cards";
import { JOURNEY, PROGRAMME, TIMELINE } from "@/config/programme";
import { windowSummary } from "@/lib/window";
import { ApplicationStatus } from "./ApplicationStatus";
import { AlliedArt, MaizeArt, RiceArt, SoybeanArt } from "./art";

/** ProgrammeSection: consistent editorial heading + spacing for every home-page block. */
export function ProgrammeSection({ id, eyebrow, title, intro, children, tint = false }:
  { id?: string; eyebrow: string; title: React.ReactNode; intro?: string; children: React.ReactNode; tint?: boolean }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-paper-line bg-white py-14 sm:py-20">
      <div className="container-page">
        <Reveal>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-2 max-w-3xl font-display text-display-lg text-primary">{title}</h2>
          {intro && <p className="mt-3 max-w-2xl text-base text-ink-soft">{intro}</p>}
        </Reveal>
        <div className="mt-8 sm:mt-10">{children}</div>
      </div>
    </section>
  );
}

/** Two plain bullet lists (who / what) on white, in the flyers' "Target participants / Training focus" structure. */
export function ProgrammeOverview() {
  return (
    <section id="programme" className="scroll-mt-24 border-t border-paper-line bg-white py-14 sm:py-20">
      <div className="container-page">
        <Reveal>
          <p className="eyebrow">The programme</p>
          <h2 className="mt-2 max-w-3xl font-display text-display-lg text-primary">A contest and a classroom, built as one.</h2>
          <p className="mt-3 max-w-2xl text-base text-ink-soft">Agriculture employs more young Nigerians than any other sector, yet many agripreneurs struggle to reach advice and capital. We find the strongest youth-led ideas, train them, and put them in front of financiers.</p>
        </Reveal>
        <div className="dash-line my-8" aria-hidden="true" />
        <div className="grid gap-8 md:grid-cols-2 md:gap-14">
          <Reveal>
            <h3 className="font-display text-lg italic text-azure">Who can apply:</h3>
            <div className="mt-4 text-ink">
              <BulletList tone="onLight" items={[
                `Nigerian youth aged ${PROGRAMME.eligibility.minAge} to ${PROGRAMME.eligibility.maxAge}`,
                "Running an agribusiness, or building one",
                "From any state in Nigeria",
                "Working in maize, rice, soybean or allied agrifood value chains",
                "At any stage, from idea to established business",
              ]} />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h3 className="font-display text-lg italic text-azure">What the programme provides:</h3>
            <div className="mt-4 text-ink">
              <BulletList tone="onLight" items={[
                "Certified access-to-finance training",
                "Pitch rounds judged by expert reviewers",
                "A live Grand Finale and Deal Room with financiers",
                "Seed capital and support for ten winners",
                "Six months of mentorship and aftercare for winners",
              ]} />
            </div>
          </Reveal>
        </div>
        <p className="mt-8 max-w-2xl text-sm text-ink-muted">Women, rural youth and persons with disabilities are strongly encouraged to apply.</p>
      </div>
    </section>
  );
}

export function Benefits() {
  return (
    <ProgrammeSection id="benefits" eyebrow="Benefits" title="What you can gain.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal><ProgrammeStat tone="yellow" value={10} label="winners receive seed capital and support" /></Reveal>
        <Reveal delay={80}><ProgrammeStat tone="green" value={30} label="finalists pitch live at the Grand Finale" /></Reveal>
        <Reveal delay={160}><ProgrammeStat tone="blue" value={100} suffix="+" label="youths trained in access to finance" /></Reveal>
        <Reveal delay={240}><ProgrammeStat tone="primary" value={6} label="months of aftercare for winners" /></Reveal>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Reveal><GreenCard className="h-full" eyebrow="Deal Room" title="Meet the people who fund agribusiness">Banks, development finance institutions, agri-lenders and impact investors.</GreenCard></Reveal>
        <Reveal delay={100}><BlueCard className="h-full" eyebrow="Showcase" title="Be seen by financiers">Outstanding innovations are profiled in an Innovation Showcase Register. Every applicant receives feedback.</BlueCard></Reveal>
        <Reveal delay={200}><YellowCard className="h-full" eyebrow="Training" title="Certified, in English and Hausa">An eight-module access-to-finance programme that makes youth ventures investable.</YellowCard></Reveal>
      </div>
    </ProgrammeSection>
  );
}

export function ValueChains() {
  const tiles = [
    { name: "Maize", note: "From field to feed mill", bg: "bg-[#fbf6cf]", Art: MaizeArt },
    { name: "Rice", note: "Paddy to milled grain", bg: "bg-[#d9fbd3]", Art: RiceArt },
    { name: "Soybean", note: "Protein and value addition", bg: "bg-[#d6ebf8]", Art: SoybeanArt },
    { name: "Allied commodities", note: "Other agrifood value chains", bg: "bg-[#e3efe8]", Art: AlliedArt },
  ];
  return (
    <ProgrammeSection id="value-chains" eyebrow="Focus areas" title={<>Four value chains, <span className="text-azure">one goal.</span></>} >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ name, note, bg, Art }, i) => (
          <Reveal as="li" key={name} delay={i * 90}>
            <div className={`group relative flex h-[280px] flex-col justify-end overflow-hidden rounded-card ${bg}`}>
              <Art className="zoom-art absolute inset-x-0 top-0 mx-auto h-[200px] w-[200px]" />
              <div className="relative bg-gradient-to-t from-white via-white/90 to-transparent px-5 pb-5 pt-10">
                <h3 className="font-display text-lg text-primary">{name}</h3>
                <p className="text-sm text-ink-soft">{note}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </ProgrammeSection>
  );
}

export function HowItWorks() {
  const tones = ["yellow", "green", "blue", "light", "primary"] as const;
  return (
    <ProgrammeSection id="how-it-works" eyebrow="How it works" title="From application to award.">
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {JOURNEY.map((j, i) => (
          <Reveal as="li" key={j.step} delay={i * 90}>
            <InfoCard tone={tones[i]} className="h-full" eyebrow={j.date} title={j.step}>{j.note}</InfoCard>
          </Reveal>
        ))}
      </ol>
    </ProgrammeSection>
  );
}

/** MentorCTA: invites experts to the mentor application. */
export function MentorCTA() {
  return (
    <section className="border-t border-paper-line bg-white py-10 sm:py-14">
      <div className="container-page">
        <Reveal>
          <div className="relative grid items-center gap-6 overflow-hidden rounded-[1.75rem] bg-azure p-7 text-white sm:p-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="eyebrow !text-sun">Call for Experts</p>
              <h2 className="mt-3 font-display text-display-lg !text-white">Mentors, Judges and Reviewers: help young agripreneurs grow.</h2>
              <p className="mt-3 max-w-xl text-base text-white/90">If you have experience in agribusiness, finance or enterprise support, we would like to hear from you.</p>
            </div>
            <div className="lg:justify-self-end">
              <LinkButton href="/mentors" className="!rounded-full !bg-sun !px-7 !py-3 text-sm !text-night hover:!bg-lime">Call for Experts</LinkButton>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** ApplicationCTA: the closing call to action on a bold yellow card. */
export function ApplicationCTA() {
  const w = windowSummary();
  return (
    <section id="apply" className="scroll-mt-24 bg-white pb-14 sm:pb-20">
      <div className="container-page">
        <Reveal>
          <div className="relative overflow-hidden rounded-[1.75rem] bg-sun p-7 text-night sm:p-10">
            <div className="relative grid items-end gap-8 md:grid-cols-[1.5fr_1fr]">
              <div>
                <h2 className="max-w-2xl font-display text-display-xl text-night">{w.status === "CLOSED" ? "Applications are now closed." : "Ready to show what you are building?"}</h2>
                <p className="mt-3 text-base font-medium">{w.range}</p>
              </div>
              <div className="flex flex-col items-start gap-4 md:items-end">
                {w.status === "OPEN"
                  ? <LinkButton href="/apply" className="!rounded-full !bg-primary !px-8 !py-3 text-sm !text-white hover:!bg-primary-800">Apply Now</LinkButton>
                  : <span aria-disabled="true" className="inline-flex rounded-full bg-night/10 px-7 py-4 text-base font-bold">{w.cta}</span>}
                <ApplicationStatus />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FAQS = [
  ["Who can apply?", `Nigerian youth aged ${PROGRAMME.eligibility.minAge} to ${PROGRAMME.eligibility.maxAge} who run or are building an agribusiness, especially in maize, rice, soybean or allied agrifood value chains.`],
  ["Do I need to live in a particular state?", "No. The contest is open to applicants from every state in Nigeria."],
  ["Does my business need to be registered?", "No. You will be asked for your registration status and, if you are registered with the CAC, your registration number."],
  ["Can I save my application and finish later?", "Yes. Use “Save progress” at any time. Your answers are also kept on your device."],
  ["What happens after I submit?", "You will receive an application reference number. Keep it for any communication with the programme team. Submitting does not guarantee selection."],
  ["Can I change my application after submitting?", "Not through the form. Please contact the programme team with your reference number."],
];
export function Faq() {
  return (
    <ProgrammeSection id="faq" eyebrow="Questions" title="Frequently asked questions.">
      <div className="max-w-3xl divide-y divide-primary/15 border-y border-primary/15">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group py-1">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 py-2.5 text-left font-display text-base text-primary [&::-webkit-details-marker]:hidden">
              {q}<span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sun text-xl font-light text-night transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="pb-4 pr-12 text-sm text-ink-soft">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-sm text-ink-muted">More questions? <Link href={`mailto:${PROGRAMME.contactEmail}`} className="font-semibold text-azure underline">{PROGRAMME.contactEmail}</Link></p>
    </ProgrammeSection>
  );
}
