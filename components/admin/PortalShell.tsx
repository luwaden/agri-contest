import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { homeFor } from "@/lib/auth/permissions";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { isDemoMode } from "@/lib/data";

/** Wraps every signed-in admin page: checks the session, redirects judges to their own portal, renders the nav. */
export async function PortalShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role === "JUDGE") redirect(homeFor("JUDGE"));
  return (
    <div className="min-h-screen bg-paper-warm">
      {isDemoMode() && <div role="status" className="bg-warn-bg px-4 py-2 text-center text-sm font-semibold text-warn-fg no-print">DEMO MODE: the figures below are generated sample data, not real applicants.</div>}
      <header className="border-b border-paper-line bg-white no-print">
        <div className="container-page max-w-7xl flex h-14 items-center justify-between gap-4">
          <nav aria-label="Admin" className="flex items-center gap-6 text-sm font-medium">
            <Link href="/admin" className="font-display text-base font-bold text-forest-900">Contest admin</Link>
            <Link href="/admin" className="text-ink-soft hover:text-leaf-800">Dashboard</Link>
            <Link href="/admin/applications" className="text-ink-soft hover:text-leaf-800">Applications</Link>
          </nav>
          <div className="flex items-center gap-3 text-sm"><span className="hidden text-ink-muted sm:inline">{user.name} · {user.role.toLowerCase()}</span><SignOutButton /></div>
        </div>
      </header>
      <main id="main" className="container-page max-w-7xl py-8 print-page">{children}</main>
    </div>
  );
}
