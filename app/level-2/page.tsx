import type { Metadata } from "next";
import { PageShell } from "@/components/landing/PageShell";
import { Level2Form } from "@/components/level2/Level2Form";
import { LEVEL2 } from "@/config/level2";
import { MAX_BYTES } from "@/lib/cloudinary/validate";
import { OFF_MESSAGE, features } from "@/lib/features";
import { PROGRAMME } from "@/config/programme";

/** Not linked from any page and not indexed. Access is by invitation (Level 1 code + email), checked on the server. */
export const metadata: Metadata = { title: LEVEL2.title, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Level2Page() {
  const on = await features();
  return (
    <PageShell applyButton={false}>
      <section className="bg-white py-12 sm:py-16">
        <div className="container-page max-w-3xl">
          <p className="inline-block rounded-2xl bg-primary px-4 py-1.5 text-sm font-bold text-white">By invitation</p>
          <h1 className="mt-5 font-display text-4xl font-extrabold text-primary sm:text-5xl">{LEVEL2.title}</h1>
          <p className="mt-3 text-lg text-ink-soft">{LEVEL2.intro}</p>
          <div className="mt-8">{on.level2Form ? <Level2Form uploadMaxMb={Math.round(MAX_BYTES() / 1048576)} uploadsAllowed={on.level2Uploads} /> : (
            <div role="status" className="rounded-card border border-paper-line bg-white p-6 sm:p-8">
              <h2 className="font-display text-2xl font-extrabold text-primary">The form is closed for now</h2>
              <p className="mt-2 text-ink-soft">{OFF_MESSAGE.level2Form}</p>
              <p className="mt-2 text-sm text-ink-muted">Questions: <a href={`mailto:${PROGRAMME.contactEmail}`} className="font-semibold text-primary underline">{PROGRAMME.contactEmail}</a></p>
            </div>)}</div>
        </div>
      </section>
    </PageShell>
  );
}
