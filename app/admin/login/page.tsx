import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };
export default function LoginPage() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-paper-warm px-5">
      <div className="w-full max-w-sm animate-rise">
        <p className="eyebrow">Programme staff</p>
        <h1 className="mb-6 mt-2 font-display text-3xl font-semibold">Sign in</h1>
        <LoginForm />
      </div>
    </main>
  );
}
