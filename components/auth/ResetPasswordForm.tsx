"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function ResetPasswordForm({ token }: { token: string }) {
  const [msg, setMsg] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const pw = String(f.get("password") ?? ""), again = String(f.get("again") ?? "");
    if (pw !== again) { setMsg("The two passwords are different."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(d.message || "Something went wrong. Please try again."); return; }
      setDone(true);
    } catch { setMsg("We could not reach the server. Please try again."); } finally { setBusy(false); }
  }
  if (done) return (<div role="status" className="space-y-4"><p className="rounded-md border border-primary/30 bg-lime/30 px-4 py-3 font-medium text-primary">Your password has been changed. Any other signed-in sessions have been signed out.</p><Link href="/admin/login" className="inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-white">Sign in</Link></div>);
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {msg && <p role="alert" className="rounded-md border border-danger-line bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">{msg}</p>}
      <div className="space-y-1.5"><label htmlFor="password" className="block text-[15px] font-medium">New password</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input-base" /><p className="text-xs text-ink-muted">At least 10 characters. A short sentence works well.</p></div>
      <div className="space-y-1.5"><label htmlFor="again" className="block text-[15px] font-medium">Type it again</label><input id="again" name="again" type="password" autoComplete="new-password" required className="input-base" /></div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Set new password"}</Button>
    </form>
  );
}
