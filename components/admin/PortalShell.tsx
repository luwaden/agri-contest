import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { can, homeFor } from "@/lib/auth/permissions";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { Wordmark } from "@/components/brand/Wordmark";
import { isDemoMode } from "@/lib/data";

/** Wraps every signed-in admin page: checks the session, sends judges to their own portal, renders the nav. */
export async function PortalShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role === "JUDGE") redirect(homeFor("JUDGE"));
  const links: Array<[string, string, boolean]> = [
    ["Dashboard", "/admin", true], ["Applications", "/admin/applications", true],
    ["Mentors", "/admin/mentors", can(user.role, "mentors:review")], ["AI assistant", "/admin/ai", can(user.role, "ai:query")],
  ];
  return (
    <div className="min-h-screen bg-paper-warm">
      {isDemoMode() && <div role="status" className="bg-warn-bg px-4 py-2 text-center text-sm font-semibold text-warn-fg no-print">DEMO MODE: the figures below are generated sample data, not real applicants.</div>}
      <header className="no-print bg-primary text-white">
        <div className="container-page flex min-h-[72px] max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <Link href="/admin" aria-label="Contest admin home"><Wordmark tone="onDark" /></Link>
            <nav aria-label="Admin" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold">
              {links.filter((l) => l[2]).map(([l, h]) => <Link key={h} href={h} className="rounded-full px-3 py-1.5 text-white/90 hover:bg-white/10 hover:text-sun">{l}</Link>)}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm"><span className="hidden text-white/80 sm:inline">{user.name} · {user.role.toLowerCase()}</span><span className="[&_button]:!text-sun"><SignOutButton /></span></div>
        </div>
      </header>
      <main id="main" className="container-page max-w-7xl py-8 print-page">{children}</main>
    </div>
  );
}
