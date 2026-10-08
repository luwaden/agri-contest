import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import { SystemCheck } from "@/components/admin/SystemCheck";
import { requirePagePermission } from "@/lib/auth/server";
import { APP_VERSION, commit } from "@/lib/version";
export const metadata: Metadata = { title: "System check", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function SystemPage() {
  await requirePagePermission("reports:view");
  return (<PortalShell><div className="max-w-3xl space-y-5"><div><h1 className="font-display text-3xl text-primary">System check</h1>
    <p className="text-sm text-ink-soft">Tests, on the live server, everything an application needs to reach the Google Sheet: settings, Redis, the sheet connection, the header row, a real write-and-read-back, and the form-to-row conversion. It writes one audit entry (SYSTEM_CHECK) and never adds a fake application. Live version {APP_VERSION} · build {commit()}.</p></div><SystemCheck /></div></PortalShell>);
}
