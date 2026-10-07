import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import { MentorTable } from "@/components/admin/MentorTable";
import { requirePagePermission } from "@/lib/auth/server";
export const metadata: Metadata = { title: "Mentor applications", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function MentorsAdmin() {
  await requirePagePermission("mentors:review");
  return (<PortalShell><div className="space-y-5"><div><h1 className="font-display text-3xl text-primary">Mentor applications</h1><p className="text-sm text-ink-soft">Stored separately from applicant records.</p></div><MentorTable /></div></PortalShell>);
}
