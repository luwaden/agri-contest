import { HEADER_PARTNERS } from "@/config/programme";
import { PartnerLogo } from "@/components/ui/PartnerLogo";

/** Credibility strip at the very top of the site. Order is fixed by config. */
export function PartnerLogoStrip() {
  return (
    <div className="border-b border-paper-line bg-white">
      <div className="container-page">
        <ul aria-label="Programme partners" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 py-3 sm:gap-x-0 sm:py-4">
          {HEADER_PARTNERS.map((p, i) => (
            <li key={p.id} className={`flex items-center justify-center sm:px-6 lg:px-9 ${i > 0 ? "sm:border-l sm:border-primary/25" : ""}`}>
              <PartnerLogo partner={p} eager className="h-8 sm:h-11 lg:h-12" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
