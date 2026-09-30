import { SiteHeader } from "@/components/landing/SiteHeader";
import { ApplyCta, Benefits, Eligibility, Faq, FocalStates, Gallery, Hero, HowItWorks, Overview, Partners, SiteFooter, StatsBand, ValueChains } from "@/components/landing/sections";
import { windowSummary } from "@/lib/window";

export const dynamic = "force-dynamic"; // application status depends on the current date

export default function Home() {
  const w = windowSummary();
  return (
    <>
      <SiteHeader cta={w.cta} canApply={w.status === "OPEN"} />
      <main id="main">
        <Hero /><StatsBand /><Overview /><ValueChains /><Gallery /><FocalStates /><Eligibility /><Benefits /><HowItWorks /><ApplyCta /><Partners /><Faq />
      </main>
      <SiteFooter />
    </>
  );
}
