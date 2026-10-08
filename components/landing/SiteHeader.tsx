"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LinkButton } from "@/components/ui/Button";
import { Wordmark } from "@/components/brand/Wordmark";

/** Anchor links only make sense on the long-form homepage. Every other page gets the short menu. */
const FULL_NAV = [
  { href: "/#programme", label: "Programme" }, { href: "/#benefits", label: "Benefits" }, { href: "/#value-chains", label: "Value chains" },
  { href: "/#how-it-works", label: "How it works" }, { href: "/mentors", label: "Join the panel" }, { href: "/#faq", label: "FAQ" },
];
const SHORT_NAV = [{ href: "/mentors", label: "Join the panel" }];

export function SiteHeader({ cta, canApply, full = true }: { cta: string; canApply: boolean; full?: boolean }) {
  const NAV = full ? FULL_NAV : SHORT_NAV;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`sticky top-0 z-40 bg-white/95 backdrop-blur transition-shadow ${scrolled ? "shadow-[0_8px_24px_-18px_rgba(0,57,36,.55)]" : "border-b border-paper-line"}`}>
      <div className="container-page flex h-[68px] items-center justify-between gap-3 sm:h-20">
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)} aria-label="AGRA–SMEDAN Youth Agri-Innovation Contest, home"><Wordmark /></Link>
        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {NAV.map((n) => <Link key={n.href} href={n.href} className="text-[15px] font-semibold text-ink-soft transition-colors hover:text-primary">{n.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <LinkButton href={canApply ? "/apply" : "/#apply"} className="!rounded-full !bg-sun !px-4 !py-2.5 text-sm !text-night hover:!bg-lime whitespace-nowrap sm:!px-5">
            {canApply ? "Apply Now" : cta.startsWith("Applications Open") ? "Opening soon" : "Closed"}
          </LinkButton>
          <button type="button" className="rounded-md p-2.5 lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">{open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M3 7h18M3 12h18M3 17h18" />}</svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="animate-fade border-t border-paper-line bg-white lg:hidden">
          <ul className="container-page py-2">
            {NAV.map((n) => <li key={n.href}><Link href={n.href} onClick={() => setOpen(false)} className="block border-b border-paper-line/70 py-4 text-lg font-bold text-primary last:border-0">{n.label}</Link></li>)}
          </ul>
        </nav>
      )}
    </header>
  );
}
