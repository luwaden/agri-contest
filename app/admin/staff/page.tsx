import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import { StaffTable } from "@/components/admin/StaffTable";
import { PanelInvites } from "@/components/admin/PanelInvites";
import { requirePagePermission } from "@/lib/auth/server";
import { listStaff } from "@/lib/auth/users";
import { passwordResetAvailable } from "@/lib/auth/passwords";
import { panelCandidates } from "@/lib/services/staffService";

export const metadata: Metadata = { title: "Staff accounts", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Staff accounts: create them from panel applications (one click, emailed invites), add anyone else, manage roles and access. */
export default async function StaffPage() {
  const me = await requirePagePermission("users:manage");
  const [staff, candidates] = await Promise.all([listStaff(), panelCandidates().catch(() => [])]);
  const linksOn = passwordResetAvailable();
  return (
    <PortalShell>
      <div className="space-y-6">
        <div><h1 className="font-display text-3xl text-primary">Staff accounts</h1>
          <p className="text-sm text-ink-soft">Everyone who can sign in: administrators, coordinators, judges and reviewers.</p></div>
        <PanelInvites candidates={candidates} linksOn={linksOn} />
        <StaffTable staff={staff} linksOn={linksOn} me={me.email} />
      </div>
    </PortalShell>
  );
}
