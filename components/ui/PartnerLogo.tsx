import type { Partner } from "@/config/programme";

/**
 * Shows a supplied logo at its true proportions (width/height attributes + `w-auto`; never stretched or recoloured).
 * If a logo file has not been supplied yet, shows the organisation's name in plain type inside a dashed outline,
 * which cannot be mistaken for an official mark.
 */
/** `box` = the image fills a fixed box set by `className` (e.g. "h-10 w-full") and is scaled to fit, never stretched. */
export function PartnerLogo({ partner, className = "h-10 sm:h-12", eager = false, box = false }: { partner: Partner; className?: string; eager?: boolean; box?: boolean }) {
  if (!partner.logo || !partner.w || !partner.h) {
    return <span className="inline-flex items-center justify-center rounded-md border border-dashed border-primary/40 px-3 py-2 text-center text-xs font-semibold leading-tight text-ink-soft">{partner.name}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={partner.logo} alt={`${partner.name} logo`} width={partner.w} height={partner.h}
      loading={eager ? "eager" : "lazy"} decoding="async" className={`${className} ${box ? "" : "w-auto"} max-w-full object-contain`} />
  );
}
