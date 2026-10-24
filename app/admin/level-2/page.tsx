import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import { Level2Admin } from "@/components/admin/level2/Level2Admin";
import { requirePagePermission } from "@/lib/auth/server";
import { can } from "@/lib/auth/permissions";
import { level2Overview } from "@/lib/services/level2Service";

export const metadata: Metadata = { title: "Level 2", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Level2AdminPage() {
  const user = await requirePagePermission("applications:view");
  let data: Awaited<ReturnType<typeof level2Overview>>;
  try { data = await level2Overview(); }
  catch (e) {
    const missing = /tab does not exist/.test(String((e as Error)?.message));
    return <PortalShell><div role="alert" className="rounded-lg border border-danger-line bg-danger-bg p-6 text-danger-fg"><h1 className="font-display text-2xl font-extrabold">Level 2 could not load</h1>
      <p className="mt-2">{missing ? "The Level 2 tabs do not exist yet. Run npm run setup:sheets once (it only adds the new tabs), then reload." : "Google Sheets did not answer in time. Reload the page in a minute."}</p></div></PortalShell>;
  }
  const link = `${(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")}/level-2`;
  return (
    <PortalShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div><h1 className="font-display text-3xl font-extrabold">Level 2 application</h1>
          <p className="mt-1 text-sm text-ink-soft">A hidden form for invited Level 1 applicants. Answers go to the “Level 2 Applications” tab.</p></div>
        <Level2Admin data={data} link={link} mayInvite={can(user.role, "applications:status")} mayExport={can(user.role, "export:data")} />
      </div>
    </PortalShell>
  );
}
