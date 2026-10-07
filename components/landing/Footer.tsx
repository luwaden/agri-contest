import Link from "next/link";
import { FOOTER_PARTNERS, IMPLEMENTER, PROGRAMME } from "@/config/programme";
import { PartnerLogo } from "@/components/ui/PartnerLogo";
import { Wordmark } from "@/components/brand/Wordmark";

const FULL_COLS: Array<[string, Array<[string, string]>]> = [
  ["Programme", [["Overview", "/#programme"], ["Benefits", "/#benefits"], ["Value chains", "/#value-chains"], ["How it works", "/#how-it-works"]]],
  ["Get involved", [["Apply", "/apply"], ["Call for mentors", "/mentors"], ["FAQ", "/#faq"]]],
  ["About", [["Privacy notice", "/privacy"], ["Terms", "/terms"], ["Staff sign in", "/admin/login"]]],
];
const SHORT_COLS: Array<[string, Array<[string, string]>]> = [
  ["Get involved", [["Apply", "/apply"], ["Call for mentors", "/mentors"]]],
  ["About", [["Privacy notice", "/privacy"], ["Terms", "/terms"], ["Staff sign in", "/admin/login"]]],
];

/** Footer: primary-green anchor with link columns and the institutional partner area. */
export function SiteFooter({ full = true }: { full?: boolean }) {
  const COLS = full ? FULL_COLS : SHORT_COLS;
  return (
    <footer className="bg-primary text-white" aria-label="Site footer">
      <div className="container-page grid gap-12 pb-10 pt-16 lg:grid-cols-[1.4fr_2fr]">
        <div>
          <Wordmark tone="onDark" size="lg" />
          <p className="mt-5 max-w-sm text-white/85">{PROGRAMME.tagline}</p>
          <p className="mt-4 font-semibold text-lime">{PROGRAMME.hashtag}</p>
          <p className="mt-6 text-sm text-white/85">Contact: <a className="font-semibold text-white underline underline-offset-2" href={`mailto:${PROGRAMME.contactEmail}`}>{PROGRAMME.contactEmail}</a></p>
        </div>
        <nav aria-label="Footer" className={`grid gap-8 ${full ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {COLS.map(([h, links]) => (
            <div key={h}>
              <h2 className="text-sm font-bold uppercase tracking-[0.14em] !text-lime">{h}</h2>
              <ul className="mt-4 space-y-3">{links.map(([l, href]) => <li key={l}><Link href={href} className="text-white/90 hover:text-sun hover:underline">{l}</Link></li>)}</ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Institutional partner area. Logos keep their original colours, so they sit on a white plate.
          Every logo gets an identical cell and an identical image box (scaled to fit, never stretched). */}
      <div className="container-page pb-10">
        <div className="grid gap-6 rounded-card bg-white p-5 text-ink sm:p-7 lg:grid-cols-[1fr_auto] lg:gap-8">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] !text-ink-muted">Development partners</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {FOOTER_PARTNERS.map((p) => (
                <li key={p.id} className="flex h-20 items-center justify-center rounded-tile border border-paper-line bg-white px-5">
                  <PartnerLogo partner={p} box className="h-12 w-full" />
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-dashed border-primary/30 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] !text-ink-muted">Implemented by</h2>
            <div className="mt-4 flex h-20 items-center justify-center rounded-tile border border-paper-line bg-white px-5 sm:w-56">
              <PartnerLogo partner={IMPLEMENTER} box className="h-12 w-full" />
            </div>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-white/70">© {new Date().getFullYear()} {PROGRAMME.name}. All partner logos are the property of their respective organisations.</p>
      </div>
    </footer>
  );
}
