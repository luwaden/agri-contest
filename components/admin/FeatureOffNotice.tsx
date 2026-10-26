import Link from "next/link";
import { FEATURES, type FeatureKey } from "@/config/features";
import { features } from "@/lib/features";

/** A short notice at the top of a page whose feature is switched off in Admin → Settings. Renders nothing when everything listed is on. */
export async function FeatureOffNotice({ keys, settingsLink = false }: { keys: FeatureKey[]; settingsLink?: boolean }) {
  const on = await features();
  const off = keys.filter((k) => !on[k]);
  if (!off.length) return null;
  return (
    <div role="status" className="rounded-md border border-warn-fg/20 bg-warn-bg px-4 py-3 text-sm text-warn-fg">
      {off.map((k) => <p key={k}><strong>{FEATURES[k].label}: off.</strong> {FEATURES[k].off}</p>)}
      {settingsLink && <p className="mt-1"><Link href="/admin/settings" className="font-semibold underline">Change in Settings</Link></p>}
    </div>
  );
}
