import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import { requirePagePermission } from "@/lib/auth/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export default async function AdminHome() {
  await requirePagePermission("analytics:view");
  return <PortalShell><DashboardClient /></PortalShell>;
}
export const dynamic = "force-dynamic";
