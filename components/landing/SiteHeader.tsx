"use client";
import Link from "next/link";
import { useState } from "react";
import { LinkButton } from "@/components/ui/Button";

const NAV = [
  { href: "/#programme", label: "Programme" }, { href: "/#eligibility", label: "Eligibility" }, { href: "/#value-chains", label: "Value chains" },
  { href: "/#benefits", label: "Benefits" }, { href: "/#how-it-works", label: "How it works" }, { href: "/#faq", label: "FAQ" },
];

export function SiteHeader({ cta, canApply }: { cta: string; canApply: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-paper-line bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-baseline gap-2" onClick={() => setOpen(false)}>
          <span className="font-display text-lg font-bold text-forest-900">AGRA–SMEDAN</span>
          <span className="hidden text-sm text-ink-muted sm:inline">Youth Agri-Innovation Contest</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
          {NAV.map((n) => <Link key={n.href} href={n.href} className="text-sm font-medium text-ink-soft transition-colors hover:text-leaf-800">{n.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <LinkButton href={canApply ? "/apply" : "/#apply"} className="!px-4 !py-2 text-sm">{canApply ? "Apply Now" : cta.startsWith("Applications Open") ? "Opening soon" : "Closed"}</LinkButton>
          <button type="button" className="rounded-md p-2.5 lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{open ? <path d="M5 5l12 12M17 5L5 17" /> : <path d="M3 7h16M3 15h16" />}</svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="animate-fade border-t border-paper-line bg-white lg:hidden">
          <ul className="container-page py-2">
            {NAV.map((n) => <li key={n.href}><Link href={n.href} onClick={() => setOpen(false)} className="block border-b border-paper-line/70 py-3.5 text-base font-medium text-forest-900 last:border-0">{n.label}</Link></li>)}
          </ul>
        </nav>
      )}
    </header>
  );
}
