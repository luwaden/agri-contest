import { PartnerLogoStrip } from "./PartnerLogoStrip";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./Footer";
import { windowSummary } from "@/lib/window";

/** Common frame for public pages: partner strip, header, footer. */
export function PageShell({ children, applyButton = true }: { children: React.ReactNode; applyButton?: boolean }) {
  const w = windowSummary();
  return (
    <>
      <PartnerLogoStrip />
      <SiteHeader cta={w.cta} canApply={w.status === "OPEN"} applyButton={applyButton} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
