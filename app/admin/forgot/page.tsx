import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { PROGRAMME } from "@/config/programme";

export const metadata: Metadata = { title: "Forgot your password?", robots: { index: false } };

export default function ForgotPage() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-paper-warm px-5">
      <div className="w-full max-w-md">
        <div className="mb-8"><Wordmark /></div>
        <h1 className="font-display text-3xl text-primary">Forgot your password?</h1>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-ink-soft">
          <li>Contact a programme administrator and ask for a <strong>password reset link</strong>.</li>
          <li>They will send you a private link. It works once, for 30 minutes.</li>
          <li>Open it, choose a new password, and sign in.</li>
        </ol>
        <p className="mt-5 text-sm text-ink-soft">Programme team: <a className="font-semibold text-azure underline" href={`mailto:${PROGRAMME.contactEmail}?subject=${encodeURIComponent("Password reset request")}`}>{PROGRAMME.contactEmail}</a>. Never share your password with anyone, including the programme team.</p>
        <p className="mt-8"><Link href="/admin/login" className="font-semibold text-primary underline">Back to sign in</Link></p>
      </div>
    </main>
  );
}
