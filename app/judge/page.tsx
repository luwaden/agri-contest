import { requirePagePermission } from "@/lib/auth/server";
import { Wordmark } from "@/components/brand/Wordmark";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { DEFAULT_CRITERIA } from "@/config/scoring";

export const dynamic = "force-dynamic";

/** Batch 1: authenticated judge landing page only. Assignment and scoring arrive in Batch 3. */
export default async function JudgePage() {
  const user = await requirePagePermission("scores:submit");
  return (
    <main id="main" className="container-page max-w-2xl py-16">
      <div className="mb-10"><Wordmark /></div>
      <p className="eyebrow">Judge portal</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">Welcome, {user.name}</h1>
      <p className="mt-4 text-ink-soft">Judging has not opened yet. When it does, your assigned applications and the scoring form will appear here.</p>
      <p className="mt-2 text-sm text-ink-muted">{DEFAULT_CRITERIA.filter((c) => c.active).length} scoring criteria are currently configured (draft rubric, to be confirmed by the programme).</p>
      <div className="mt-8"><SignOutButton /></div>
    </main>
  );
}
