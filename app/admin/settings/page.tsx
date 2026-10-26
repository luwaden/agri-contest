import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import { FeatureSwitches } from "@/components/admin/settings/FeatureSwitches";
import { requirePagePermission } from "@/lib/auth/server";
import { loadFeatures } from "@/lib/features";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Feature switches. Administrators only (config:manage); every change is recorded with who and when. */
export default async function SettingsPage() {
  await requirePagePermission("config:manage");
  const snap = await loadFeatures(true);
  return (
    <PortalShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div><h1 className="font-display text-3xl font-extrabold">Settings</h1>
          <p className="mt-1 text-sm text-ink-soft">Turn parts of the system on or off. Changes are checked on the server, take effect within about 20 seconds,
            and are recorded in the “Configuration” tab of the sheet and the activity log. Turning a form off never deletes anything already submitted.</p></div>
        <FeatureSwitches initial={snap} />
      </div>
    </PortalShell>
  );
}
