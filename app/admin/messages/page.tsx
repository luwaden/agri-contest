import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import { Messages } from "@/components/admin/messages/Messages";
import { requirePagePermission } from "@/lib/auth/server";
import { listCampaigns } from "@/lib/services/emailCampaignService";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Email chosen groups of applicants from the programme's sending address. Administrators only. */
export default async function MessagesPage() {
  await requirePagePermission("email:send");
  let overview: Awaited<ReturnType<typeof listCampaigns>>;
  try { overview = await listCampaigns(); }
  catch (e) {
    const tabMissing = /tab does not exist/.test(String((e as Error)?.message));
    return <PortalShell><div role="alert" className="rounded-lg border border-danger-line bg-danger-bg p-6 text-danger-fg"><h1 className="font-display text-2xl font-extrabold">Messages could not load</h1>
      <p className="mt-2">{tabMissing ? "The Email Campaigns and Email Log tabs do not exist yet. Run npm run setup:sheets once (it only adds those tabs), then reload." : "Google Sheets did not answer in time. Reload the page in a minute."}</p></div></PortalShell>;
  }
  return (
    <PortalShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div><h1 className="font-display text-3xl font-extrabold">Messages</h1>
          <p className="mt-1 text-sm text-ink-soft">Email a chosen group of applicants. Each person gets their own copy, with their name and reference filled in. Every email is recorded in the Email Log tab.</p></div>
        <Messages initial={overview} />
      </div>
    </PortalShell>
  );
}
