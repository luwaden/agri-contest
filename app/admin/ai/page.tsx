import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import { AIAnalyticsPanel } from "@/components/dashboard/AIAnalyticsPanel";
import { requirePagePermission } from "@/lib/auth/server";
export const metadata: Metadata = { title: "AI assistant", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function AIPage() {
  await requirePagePermission("ai:query");
  return (<PortalShell><div className="max-w-3xl space-y-5"><div><h1 className="font-display text-3xl text-primary">AI assistant</h1><p className="text-sm text-ink-soft">Ask questions about the applicant pool in plain language.</p></div><AIAnalyticsPanel /></div></PortalShell>);
}
