import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import { requirePagePermission } from "@/lib/auth/server";
import { can } from "@/lib/auth/permissions";
import { ApplicationTable } from "@/components/admin/ApplicationTable";
export const metadata: Metadata = { title: "Applications", robots: { index: false } };
export default async function ApplicationsPage() {
  const user = await requirePagePermission("applications:view");
  return <PortalShell><ApplicationTable canChangeStatus={can(user.role, "applications:status")} /></PortalShell>;
}
export const dynamic = "force-dynamic";
