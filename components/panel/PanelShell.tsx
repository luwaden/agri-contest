import Link from "next/link";
import { FeatureOffNotice } from "@/components/admin/FeatureOffNotice";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { Wordmark } from "@/components/brand/Wordmark";
import { homeFor, roleLabel } from "@/lib/auth/permissions";
import type { SessionUser } from "@/types/user";
import type { FeatureKey } from "@/config/features";

/** Header for the judge and reviewer portals. */
export function PanelShell({ user, children, notices = ["panelScoring"] }: { user: SessionUser; children: React.ReactNode; notices?: FeatureKey[] }) {
  const home = homeFor(user.role);
  return (
    <div className="min-h-screen bg-paper-warm">
      <header className="no-print bg-primary text-white">
        <div className="container-page flex min-h-[68px] max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <Link href={home} aria-label={`${roleLabel(user.role)} portal home`}><Wordmark tone="onDark" /></Link>
            <nav aria-label="Portal" className="flex items-center gap-x-2 text-sm font-semibold">
              <Link href={home} className="rounded-full px-3 py-1.5 text-white/90 hover:bg-white/10 hover:text-sun">My applications</Link>
              <Link href={`${home}#rubric`} className="rounded-full px-3 py-1.5 text-white/90 hover:bg-white/10 hover:text-sun">Scoring guide</Link>
              <Link href="/review/level-2" className="rounded-full px-3 py-1.5 text-white/90 hover:bg-white/10 hover:text-sun">Level 2</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm"><span className="hidden text-white/80 sm:inline">{user.name} · {roleLabel(user.role)}</span><span className="[&_button]:!text-sun"><SignOutButton /></span></div>
        </div>
      </header>
      <main id="main" className="container-page max-w-7xl py-8"><div className="mb-6 empty:hidden"><FeatureOffNotice keys={notices} /></div>{children}</main>
    </div>
  );
}
