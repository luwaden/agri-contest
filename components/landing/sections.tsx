import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { PartnerLogo } from "@/components/ui/PartnerLogo";
import { CountUp, Reveal } from "@/components/ui/motion";
import { FOCAL_STATES, PARTNERS, PROGRAMME, TIMELINE } from "@/config/programme";
import { MEDIA } from "@/config/media";
import { windowSummary } from "@/lib/window";
import { ApplicationStatus } from "./ApplicationStatus";
import { AlliedArt, Contours, FieldScene, MaizeArt, Photo, RiceArt, SoybeanArt } from "./art";

function Section({ id, eyebrow, title, children, tint = false, intro }: { id: string; eyebrow: string; title: string; children: React.ReactNode; tint?: boolean; intro?: string }) {
  return (
    <section id={id} className={`scroll-mt-16 py-16 sm:py-24 ${tint ? "bg-paper-warm" : ""}`}>
      <div className="container-page">
        <Reveal>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold sm:text-4xl">{title}</h2>
          {intro && <p className="mt-3 max-w-xl text-lg text-ink-soft">{intro}</p>}
        </Reveal>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export function Hero() {
  const w = windowSummary();
  const photo = MEDIA.hero.src;
  return (
    <section className="relative overflow-hidden bg-forest-900 text-white">
      {photo && (
        <>{/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={MEDIA.hero.alt} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-forest-950/90 via-forest-900/70 to-forest-900/20" /></>
      )}
      {!photo && <FieldScene className="absolute inset-x-0 bottom-0 h-[230px] w-full sm:h-[320px] lg:h-[360px]" />}
      <div className="container-page relative z-10 grid gap-10 pb-[190px] pt-12 sm:pb-[300px] sm:pt-20 lg:grid-cols-[1.4fr_1fr] lg:items-start lg:pb-[250px] lg:pt-20">
        <div className="animate-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf-200">{PROGRAMME.name}</p>
          <h1 className="mt-5 font-display text-display-xl font-semibold !text-white">Finding, funding and scaling the next generation of Nigerian agripreneurs.</h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/80">For young people, aged 18 to 35, growing agribusinesses in maize, rice, soybean and allied value chains.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href={w.status === "OPEN" ? "/apply" : "#apply"} variant="inverse">{w.cta}</LinkButton>
            <LinkButton href="#programme" variant="secondary" className="!border-white/40 !bg-transparent !text-white hover:!border-white hover:!bg-white/10">Learn About the Programme</LinkButton>
          </div>
        </div>
        <aside className="animate-rise space-y-4 [animation-delay:140ms] lg:justify-self-end" aria-label="Application dates">
          <ApplicationStatus inverse />
          <p className="text-sm text-white/70 sm:hidden">{w.range}</p>
          <dl className="hidden divide-y divide-white/15 border-y border-white/15 sm:block lg:min-w-[300px]">
            <div className="flex items-baseline justify-between gap-6 py-3"><dt className="text-sm text-white/65">Opens</dt><dd className="font-semibold">{w.openLabel}</dd></div>
            <div className="flex items-baseline justify-between gap-6 py-3"><dt className="text-sm text-white/65">Closes</dt><dd className="font-semibold">{w.closeLabel}</dd></div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

export function StatsBand() {
  const stats: Array<[number, string, string]> = [[10, "", "winners receive seed capital"], [30, "", "finalists pitch live"], [3, "", "focal states"], [100, "+", "youths trained in access to finance"]];
  return (
    <div className="relative z-20 -mt-12 sm:-mt-16">
      <div className="container-page">
        <Reveal className="grid grid-cols-2 divide-x divide-y divide-paper-line overflow-hidden rounded-lg border border-paper-line bg-white shadow-[0_12px_40px_-16px_rgba(10,31,19,.25)] lg:grid-cols-4 lg:divide-y-0">
          {stats.map(([n, suf, label]) => (
            <div key={label} className="p-5 sm:p-7">
              <p className="font-display text-4xl font-semibold text-leaf-700 sm:text-5xl"><CountUp to={n} suffix={suf} /></p>
              <p className="mt-1.5 text-sm text-ink-soft">{label}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </div>
  );
}

export function Overview() {
  return (
    <section id="programme" className="scroll-mt-16 py-16 sm:py-24">
      <div className="container-page grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gradient-to-b from-[#dcefe0] to-[#f6ecc9]">
            <Photo slot={MEDIA.story} className="h-full w-full" fallback={<FieldScene variant="day" className="absolute inset-x-0 bottom-0 h-full w-full" />} />
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-leaf-800">Youth · Agriculture · Innovation</span>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <p className="eyebrow">The programme</p>
          <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">A contest and a classroom, built as one.</h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">Agriculture employs more young Nigerians than any other sector, yet many agripreneurs struggle to reach advice and capital.</p>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">We find the strongest youth-led ideas, put them in front of financiers, and reward the best ten.</p>
        </Reveal>
      </div>
    </section>
  );
}

export function ValueChains() {
  const tiles = [
    { name: "Maize", note: "From field to feed mill", bg: "bg-[#fbf2d3]", Art: MaizeArt },
    { name: "Rice", note: "Paddy to milled grain", bg: "bg-leaf-100", Art: RiceArt },
    { name: "Soybean", note: "Protein and value addition", bg: "bg-[#e6efd4]", Art: SoybeanArt },
    { name: "Allied commodities", note: "Other agrifood value chains", bg: "bg-[#f3e3c8]", Art: AlliedArt },
  ];
  return (
    <Section id="value-chains" eyebrow="Focus areas" title="Four value chains, one goal." tint>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ name, note, bg, Art }, i) => (
          <Reveal as="li" key={name} delay={i * 90}>
            <div className={`group relative flex h-[320px] flex-col justify-end overflow-hidden rounded-lg ${bg}`}>
              <Art className="zoom-art absolute inset-x-0 top-0 mx-auto h-[230px] w-[230px]" />
              <div className="relative bg-gradient-to-t from-white/95 via-white/85 to-transparent px-5 pb-5 pt-10">
                <h3 className="font-display text-xl font-semibold">{name}</h3>
                <p className="text-sm text-ink-soft">{note}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}


export function Gallery() {
  const items = [[MEDIA.gallery1, "Farm to market"], [MEDIA.gallery2, "Processing hubs"], [MEDIA.gallery3, "Training and mentorship"]] as const;
  return (
    <section className="py-16 sm:py-24" aria-labelledby="gallery-h">
      <div className="container-page">
        <Reveal><p className="eyebrow">In the field</p><h2 id="gallery-h" className="mt-2 max-w-2xl font-display text-3xl font-semibold sm:text-4xl">Where opportunity takes root.</h2></Reveal>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map(([slot, caption], i) => (
            <Reveal as="li" key={caption} delay={i * 100}>
              <figure className="group relative aspect-[3/2] overflow-hidden rounded-lg bg-leaf-100">
                <Photo slot={slot} className="zoom-art absolute inset-0 h-full w-full" fallback={<FieldScene variant="day" className="absolute inset-0 h-full w-full" />} />
                <div className="absolute inset-0 bg-gradient-to-t from-forest-950/70 via-transparent to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 p-5 font-display text-xl font-semibold text-white">{caption}</figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FocalStates() {
  const slots = [MEDIA.kaduna, MEDIA.niger, MEDIA.nasarawa];
  return (
    <Section id="focal-states" eyebrow="Where we focus" title="Rooted in Kaduna, Niger and Nasarawa." intro="60% of places are aimed at these three states. Applicants from every other state are welcome for the remaining 40%.">
      <ul className="grid gap-4 md:grid-cols-3">
        {FOCAL_STATES.map((s, i) => (
          <Reveal as="li" key={s} delay={i * 100}>
            <div className="group relative h-[280px] overflow-hidden rounded-lg bg-gradient-to-br from-leaf-800 to-forest-900 text-white">
              <Photo slot={slots[i]} className="absolute inset-0 h-full w-full" fallback={<Contours seed={i} className="zoom-art absolute inset-0 h-full w-full" />} />
              <div className="absolute inset-0 bg-gradient-to-t from-forest-950/85 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-leaf-200">Focal state</p><h3 className="mt-1 font-display text-3xl font-semibold !text-white">{s}</h3></div>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

export function Eligibility() {
  const items: Array<[string, string]> = [["18–35", "years old"], ["Nigerian", "youth, from any state"], ["Any stage", "from idea to established"], ["4 chains", "maize, rice, soybean, allied"]];
  return (
    <Section id="eligibility" eyebrow="Eligibility" title="Who can apply">
      <ul className="grid grid-cols-2 gap-y-8 lg:grid-cols-4">
        {items.map(([big, small], i) => (
          <Reveal as="li" key={big} delay={i * 80} className="border-l-2 border-leaf-600 pl-5">
            <p className="font-display text-3xl font-semibold text-forest-900 sm:text-4xl">{big}</p>
            <p className="mt-1 text-sm text-ink-soft">{small}</p>
          </Reveal>
        ))}
      </ul>
      <p className="mt-10 max-w-2xl text-sm text-ink-muted">We are committed to inclusion: at least 30% women, 20% rural participation, and deliberate participation of persons with disabilities.</p>
    </Section>
  );
}

export function Benefits() {
  const small: Array<[string, string]> = [
    ["Deal Room", "Meet banks, development finance institutions and impact investors."],
    ["Six months of aftercare", "Mentorship, business support and investor matchmaking for winners."],
    ["Showcase register", "Outstanding innovations profiled for financiers and off-takers. Every applicant gets feedback."],
    ["Access-to-finance training", "Certified, eight modules, in English and Hausa, for 100+ youths."],
  ];
  return (
    <Section id="benefits" eyebrow="Benefits" title="What you can gain" tint>
      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <div className="relative flex h-full min-h-[340px] flex-col justify-start overflow-hidden rounded-lg bg-forest-900 p-7 text-white sm:p-9">
            <FieldScene className="absolute inset-x-0 bottom-0 h-[55%] w-full opacity-90" />
            <p className="relative text-xs font-semibold uppercase tracking-[0.16em] text-leaf-200">Ten winners</p>
            <h3 className="relative mt-2 max-w-md font-display text-3xl font-semibold !text-white sm:text-4xl">Seed capital and support to grow.</h3>
            <p className="relative mt-3 max-w-md text-white/75">Equipment or incubation support and national recognition at the Grand Finale.</p>
          </div>
        </Reveal>
        {small.map(([t, d], i) => (
          <Reveal key={t} delay={(i + 1) * 80} className={i === 0 ? "" : ""}>
            <div className="h-full rounded-lg border border-paper-line bg-white p-6 transition-shadow duration-300 hover:shadow-[0_10px_30px_-14px_rgba(10,31,19,.3)]">
              <span className="font-display text-sm font-semibold text-leaf-600">0{i + 1}</span>
              <h3 className="mt-2 text-lg font-semibold">{t}</h3><p className="mt-1.5 text-sm text-ink-soft">{d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function HowItWorks() {
  const steps = [["Apply", "Three short stages. Save and continue any time."], ["Screening", "The strongest applications form a Top 100."], ["Pitch", "Shortlisted applicants pitch to reach the Top 30."], ["Grand Finale", "Live final and Deal Room, 10 December 2026."]];
  return (
    <Section id="how-it-works" eyebrow="How it works" title="From application to award">
      <Reveal>
        <ol className="relative grid gap-8 md:grid-cols-4">
          <svg className="pointer-events-none absolute left-0 top-[19px] hidden h-1 w-full md:block" preserveAspectRatio="none" viewBox="0 0 100 1" aria-hidden="true"><line x1="4" y1=".5" x2="96" y2=".5" pathLength="1" className="draw" stroke="#55a86d" strokeWidth=".6" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} /></svg>
          {steps.map(([t, d], i) => (
            <li key={t} className="relative">
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-leaf-700 font-display text-sm font-semibold text-white ring-8 ring-white">{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3><p className="mt-1.5 max-w-[16rem] text-sm text-ink-soft">{d}</p>
            </li>
          ))}
        </ol>
      </Reveal>
      <dl className="mt-12 grid gap-px overflow-hidden rounded-lg border border-paper-line bg-paper-line sm:grid-cols-2 lg:grid-cols-5">
        {[{ label: "Applications open", date: windowSummary().openLabel }, { label: "Applications close", date: windowSummary().closeLabel }, ...TIMELINE.slice(2)].map((t) => <div key={t.label} className="bg-white p-4"><dt className="text-xs text-ink-muted">{t.label}</dt><dd className="mt-1 text-sm font-semibold text-forest-900">{t.date}</dd></div>)}
      </dl>
    </Section>
  );
}

export function ApplyCta() {
  const w = windowSummary();
  return (
    <section id="apply" className="relative scroll-mt-16 overflow-hidden bg-leaf-800 text-white">
      <FieldScene variant="day" className="absolute inset-x-0 bottom-0 h-[220px] w-full opacity-80 sm:h-[300px]" />
      <div className="container-page relative z-10 flex flex-col items-start gap-8 pb-[190px] pt-16 sm:pb-[250px] sm:pt-20 md:flex-row md:items-start md:justify-between">
        <Reveal>
          <h2 className="max-w-xl font-display text-3xl font-semibold !text-white sm:text-4xl">{w.status === "CLOSED" ? "Applications are now closed." : "Ready to show what you are building?"}</h2>
          <p className="mt-3 text-white/85">{w.range}</p>
        </Reveal>
        <div className="flex flex-col items-start gap-3">
          {w.status === "OPEN" ? <LinkButton href="/apply" variant="inverse">Apply Now</LinkButton>
            : <span aria-disabled="true" className="inline-flex rounded-md bg-white/15 px-5 py-3 text-[15px] font-semibold text-white">{w.cta}</span>}
          <ApplicationStatus inverse />
        </div>
      </div>
    </section>
  );
}

export function Partners() {
  return (
    <Section id="partners" eyebrow="Partners" title="Delivered with our partners">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
        {PARTNERS.map((p) => <li key={p.id} className="flex justify-center"><PartnerLogo name={p.name} role={p.role} logo={p.logo} /></li>)}
      </ul>
      <p className="mt-8 text-sm text-ink-muted">Delivery consultant: {PROGRAMME.deliveredBy}.</p>
    </Section>
  );
}

const FAQS = [
  ["Who can apply?", "Nigerian youth aged 18 to 35 who run or are building an agribusiness, especially in maize, rice, soybean or allied agrifood value chains."],
  ["Does my business need to be registered?", "No. You will be asked for your registration status and, if you are registered with the CAC, your registration number."],
  ["Can I save my application and finish later?", "Yes. Use “Save progress” at any time. Your answers are also kept on your device."],
  ["Can I apply if I am outside Kaduna, Niger or Nasarawa?", "Yes. 40% of participation is reserved for applicants from all other states."],
  ["What happens after I submit?", "You will receive an application reference number. Keep it for any communication with the programme team. Submitting does not guarantee selection."],
  ["Can I change my application after submitting?", "Not through the form. Please contact the programme team with your reference number."],
];
export function Faq() {
  return (
    <Section id="faq" eyebrow="Questions" title="Frequently asked questions" tint>
      <div className="max-w-3xl divide-y divide-paper-line border-y border-paper-line">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group py-1">
            <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-left text-[17px] font-semibold text-forest-900 [&::-webkit-details-marker]:hidden">
              {q}<span aria-hidden="true" className="text-2xl font-light text-leaf-700 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="pb-5 pr-8 text-ink-soft">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-forest-950 py-12 text-sm text-white/70">
      <div className="container-page grid gap-8 md:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="font-display text-lg font-semibold text-white">{PROGRAMME.name}</p>
          <p className="mt-2 max-w-md">{PROGRAMME.tagline}</p>
          <p className="mt-4">{PROGRAMME.hashtag}</p>
        </div>
        <div className="space-y-1.5">
          <p>Programme enquiries: <a className="text-white underline underline-offset-2" href={`mailto:${PROGRAMME.contactEmail}`}>{PROGRAMME.contactEmail}</a></p>
          <p>Delivered by {PROGRAMME.deliveredBy}.</p>
          <p className="pt-3"><Link href="/admin/login" className="text-white/50 hover:text-white">Staff sign in</Link></p>
        </div>
      </div>
    </footer>
  );
}
