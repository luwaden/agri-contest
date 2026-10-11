import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/Button";
import { REFERENCE_PATTERN } from "@/lib/reference";
import { PROGRAMME } from "@/config/programme";
import { CopyReference } from "@/components/application/CopyReference";
import { Wordmark } from "@/components/brand/Wordmark";
import { emailProvider } from "@/lib/email/send";

export const metadata: Metadata = { title: "Application received", robots: { index: false } };

export default async function Success({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  if (!ref || !REFERENCE_PATTERN.test(ref)) redirect("/apply");
  return (
    <main id="main" className="container-page max-w-2xl py-16 sm:py-24">
      <div className="animate-rise">
        <div className="mb-10"><Wordmark /></div>
        <p className="eyebrow">Application received</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">Thank you. Your application has been submitted.</h1>
        <div className="mt-10 rounded-lg border border-leaf-300 bg-leaf-50 p-6">
          <p className="text-sm font-medium text-leaf-900">Your application reference number</p>
          <p className="mt-2 break-all font-mono text-2xl font-semibold tracking-wide text-forest-900 sm:text-3xl" data-testid="reference">{ref}</p>
          <CopyReference value={ref} />
        </div>
        <p className="mt-6 text-lg text-forest-900">Keep this reference number for future communication.</p>
        {emailProvider() !== "off" && (
          <div className="mt-6 rounded-lg border border-sun/60 bg-sun/15 p-5 text-forest-900" role="note">
            <p className="font-semibold">We have also sent a confirmation email with this reference number.</p>
            <p className="mt-2 text-ink-soft">It comes from <strong className="text-forest-900">{PROGRAMME.contactEmail}</strong> and can take a few minutes. If it is not in your inbox, please check your <strong className="text-forest-900">Spam</strong> or <strong className="text-forest-900">Promotions</strong> folder and mark it as &ldquo;Not spam&rdquo;, so our future messages to you arrive safely. Adding {PROGRAMME.contactEmail} to your contacts also helps.</p>
          </div>
        )}
        <ul className="mt-6 space-y-2 text-ink-soft">
          <li>The programme team will review all applications after the call closes.</li>
          <li>Submitting an application does not guarantee selection.</li>
          <li>Questions? Email <a className="font-medium text-leaf-800 underline" href={`mailto:${PROGRAMME.contactEmail}?subject=${encodeURIComponent(ref)}`}>{PROGRAMME.contactEmail}</a> and include your reference number.</li>
        </ul>
        <div className="mt-10"><LinkButton href="/" variant="secondary">Back to the programme</LinkButton></div>
      </div>
    </main>
  );
}
