import type { Metadata } from "next";
import { FeatureOffNotice } from "@/components/admin/FeatureOffNotice";
import { PortalShell } from "@/components/admin/PortalShell";
import { DataDesk } from "@/components/admin/ai/DataDesk";
import { requirePagePermission } from "@/lib/auth/server";
import { getAIProvider } from "@/lib/ai";
import { fullAccess } from "@/lib/services/aiDataDesk";
import { outputTabsAvailable } from "@/lib/google-sheets/outputTabs";

export const metadata: Metadata = { title: "AI data desk", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AIDataDeskPage() {
  await requirePagePermission("ai:data");
  const ai = getAIProvider();
  return (
    <PortalShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="font-display text-3xl font-extrabold">AI data desk</h1>
          <p className="mt-1 text-sm text-ink-soft">Ask questions about all the applications, or ask for a list. Lists become new tabs in the Google Sheet and CSV downloads. Administrators only.</p>
        </div>
        <FeatureOffNotice keys={["aiDataDesk"]} settingsLink />
        <DataDesk ready={!!ai?.configured()} fullAccess={fullAccess()} tabsOn={outputTabsAvailable()} />
      </div>
    </PortalShell>
  );
}
