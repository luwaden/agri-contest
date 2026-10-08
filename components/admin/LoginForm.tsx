"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
      const d = await r.json();
      if (!r.ok) { setError(d.message); return; }
      router.push(d.redirect); router.refresh();
    } catch { setError("We could not reach the server. Please try again."); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <p role="alert" className="rounded-md border border-danger-line bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">{error}</p>}
      <div className="space-y-1.5"><label htmlFor="email" className="block text-[15px] font-medium">Email</label><input id="email" name="email" type="email" autoComplete="username" required className="input-base" /></div>
      <div className="space-y-1.5"><label htmlFor="password" className="block text-[15px] font-medium">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input-base" /></div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
      <p className="text-center text-sm"><Link href="/admin/forgot" className="font-semibold text-azure underline">Forgot your password?</Link></p>
    </form>
  );
}
