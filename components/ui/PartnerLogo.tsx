import Image from "next/image";
import type { Partner } from "@/config/programme";

/**
 * Renders a real logo when `logo` is set (drop the file in /public/partners),
 * otherwise a neutral monogram placeholder that cannot be mistaken for an official mark.
 */
export function PartnerLogo({ name, logo, role }: Pick<Partner, "name" | "logo" | "role">) {
  return (
    <figure className="flex flex-col items-center gap-3 text-center">
      <div className="flex h-20 w-full max-w-[200px] items-center justify-center rounded-md border border-paper-line bg-paper-warm px-4">
        {logo ? (
          <Image src={logo} alt={`${name} logo`} width={160} height={56} className="max-h-12 w-auto object-contain" />
        ) : (
          <div className="flex items-center gap-2.5" aria-hidden="true">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-neutral-400 text-xs font-semibold text-ink-muted">{name.slice(0, 2).toUpperCase()}</span>
            <span className="text-[11px] uppercase tracking-wider text-ink-muted">Partner Logo</span>
          </div>
        )}
      </div>
      <figcaption>
        <span className="block text-sm font-semibold text-forest-900">{name}</span>
        <span className="block text-xs text-ink-muted">{role}</span>
      </figcaption>
    </figure>
  );
}
