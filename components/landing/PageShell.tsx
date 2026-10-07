import { PartnerLogoStrip } from "./PartnerLogoStrip";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./Footer";
import { windowSummary } from "@/lib/window";

/** Common frame for public pages: partner strip, header, footer. */
export function PageShell({ children }: { children: React.ReactNode }) {
  const w = windowSummary();
  return (
    <>
      <PartnerLogoStrip />
      <SiteHeader cta={w.cta} canApply={w.status === "OPEN"} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
