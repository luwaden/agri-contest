import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import { StaffTable } from "@/components/admin/StaffTable";
import { requirePagePermission } from "@/lib/auth/server";
import { listStaff } from "@/lib/auth/users";
import { passwordResetAvailable } from "@/lib/auth/passwords";
export const metadata: Metadata = { title: "Staff accounts", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function StaffPage() {
  const me = await requirePagePermission("users:manage");
  return (<PortalShell><div className="space-y-5"><div><h1 className="font-display text-3xl text-primary">Staff accounts</h1><p className="text-sm text-ink-soft">Everyone who can sign in: administrators, coordinators, judges and reviewers.</p></div>
    <StaffTable staff={await listStaff()} linksOn={passwordResetAvailable()} me={me.email} /></div></PortalShell>);
}
