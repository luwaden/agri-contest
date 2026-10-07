import { LinkButton } from "@/components/ui/Button";
import { DateCard, InfoCard } from "@/components/ui/cards";
import { PROGRAMME } from "@/config/programme";
import { MEDIA } from "@/config/media";
import { windowParts, windowSummary } from "@/lib/window";
import { ApplicationStatus } from "./ApplicationStatus";
import { FieldScene, MaizeArt, RiceArt, SoybeanArt } from "./art";

/** ProgrammeHero: first screen. States what it is, who it is for, and the dates, with one clear action. */
export function ProgrammeHero() {
  const w = windowSummary(); const d = windowParts(); const photo = MEDIA.hero.src;
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="container-page relative grid items-center gap-10 py-10 sm:py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:gap-14 lg:py-14">
        <div className="animate-rise">
          <p className="bubble inline-block rounded-2xl bg-azure px-5 py-2 text-sm font-bold text-white">For young Nigerians aged {PROGRAMME.eligibility.minAge} to {PROGRAMME.eligibility.maxAge}</p>
          <h1 className="mt-7 font-display text-display-2xl !font-extrabold text-primary">
            <span className="block whitespace-nowrap">AGRA–SMEDAN</span>
            <span className="block whitespace-nowrap text-azure">Youth Agri‑Innovation</span>
            <span className="block whitespace-nowrap">Contest</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">{PROGRAMME.tagline}</p>
          <div className="dash-line my-6 max-w-xl" aria-hidden="true" />
          <dl className="grid max-w-xl grid-cols-2 gap-3">
            <DateCard tone="yellow" label="Applications open" day={d.openDay} month={d.openMonth} />
            <DateCard tone="green" label="Applications close" day={d.closeDay} month={d.closeMonth} note={d.year} />
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <LinkButton href={w.status === "OPEN" ? "/apply" : "#apply"} className="!rounded-full !bg-primary !px-7 !py-3 text-sm hover:!bg-primary-800">{w.cta}</LinkButton>
            <LinkButton href="#programme" variant="secondary" className="!rounded-full !border-primary !px-6 !py-3 text-sm !text-primary hover:!bg-primary-50">Learn About the Programme</LinkButton>
          </div>
          <div className="mt-5"><ApplicationStatus /></div>
        </div>

        <div className="relative animate-rise [animation-delay:140ms]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-gradient-to-b from-primary-800 to-primary lg:aspect-[4/5]">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={MEDIA.hero.alt} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <>
                <div className="breathe absolute right-[10%] top-[9%] aspect-square w-[34%] rounded-full bg-sun shadow-[0_0_0_18px_rgba(98,255,80,.18),0_0_0_40px_rgba(98,255,80,.08)]" aria-hidden="true" />
                <FieldScene sun={false} fit="meet" className="absolute inset-x-0 bottom-0 w-full" />
                <div className="absolute inset-x-0 bottom-[12%] flex items-end justify-center gap-1 sm:gap-3" aria-hidden="true">
                  <RiceArt solid className="h-[24%] min-h-[88px] w-auto max-h-[150px]" /><MaizeArt solid className="-mb-2 h-[34%] min-h-[110px] w-auto max-h-[210px]" /><SoybeanArt solid className="h-[24%] min-h-[88px] w-auto max-h-[150px]" />
                </div>
              </>
            )}
            <div className="absolute left-0 top-0 h-24 w-24 rounded-br-[3rem] bg-lime sm:h-28 sm:w-28" aria-hidden="true" />
          </div>
          <InfoCard tone="yellow" interactive={false} className="absolute -bottom-6 left-3 max-w-[15rem] !p-5 sm:left-[-1.5rem]" eyebrow="Open to all of Nigeria">
            <p className="text-sm font-semibold">Applicants from every state are welcome.</p>
          </InfoCard>
        </div>
      </div>
    </section>
  );
}

/** The flyers' light-green "Learn | Engage | Impact | Take Action" band, adapted to the contest journey. */
export function ProgrammeBand() {
  return (
    <div className="bg-lime text-night" aria-label="The contest journey">
      <ul className="container-page grid grid-cols-2 sm:grid-cols-4">
        {["Apply", "Pitch", "Connect", "Grow"].map((x, i) => (
          <li key={x} className={`py-3 text-center font-display text-base font-extrabold sm:py-3.5 sm:text-lg ${i > 0 ? "sm:border-l sm:border-night/30" : ""} ${i % 2 === 1 ? "border-l border-night/30 sm:border-l" : ""}`}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
