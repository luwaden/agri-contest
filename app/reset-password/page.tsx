import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { peekResetToken } from "@/lib/auth/passwords";
import { findStaff } from "@/lib/auth/users";

export const metadata: Metadata = { title: "Set your password", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const link = token ? await peekResetToken(token) : null;
  const person = link ? await findStaff(link.email).catch(() => null) : null;
  const invite = link?.purpose === "invite";
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-paper-warm px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8"><Wordmark /></div>
        {link ? (
          <>
            <h1 className="mb-2 font-display text-3xl text-primary">{invite ? `Welcome${person ? `, ${person.name.split(" ")[0]}` : ""}` : "Set a new password"}</h1>
            <p className="mb-6 text-sm text-ink-soft">{invite ? "Choose a password for your staff account" : "Choose a new password"} ({link.email}). This link works once.</p>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <div role="alert">
            <h1 className="mb-2 font-display text-3xl text-primary">This link has expired</h1>
            <p className="text-ink-soft">It may have been used already, or it is older than its time limit. Ask a programme administrator for a new one.</p>
            <p className="mt-6"><Link href="/admin/login" className="font-semibold text-primary underline">Go to sign in</Link></p>
          </div>
        )}
      </div>
    </main>
  );
}
