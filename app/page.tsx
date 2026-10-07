import type { Metadata } from "next";
import { PartnerLogoStrip } from "@/components/landing/PartnerLogoStrip";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { ProgrammeBand, ProgrammeHero } from "@/components/landing/Hero";
import { ApplicationCTA, Benefits, Faq, HowItWorks, MentorCTA, ProgrammeOverview, ValueChains } from "@/components/landing/sections";
import { SiteFooter } from "@/components/landing/Footer";
import { windowSummary } from "@/lib/window";
import { PROGRAMME } from "@/config/programme";

export const dynamic = "force-dynamic"; // application status depends on the current date
export const metadata: Metadata = {
  title: { absolute: PROGRAMME.name },
  description: `${PROGRAMME.tagline} Open to young Nigerians aged ${PROGRAMME.eligibility.minAge} to ${PROGRAMME.eligibility.maxAge} building agribusinesses in maize, rice, soybean and allied value chains.`,
  alternates: { canonical: "/" },
};

export default function Home() {
  const w = windowSummary();
  return (
    <>
      <PartnerLogoStrip />
      <SiteHeader cta={w.cta} canApply={w.status === "OPEN"} />
      <main id="main">
        <ProgrammeHero /><ProgrammeBand /><ProgrammeOverview /><Benefits /><ValueChains /><HowItWorks /><MentorCTA /><ApplicationCTA /><Faq />
      </main>
      <SiteFooter />
    </>
  );
}
