"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** After a conflict: give that application to the next least-busy person (same rules as automatic assignment). */
export function FillGapButton({ role, applicationId, target }: { role: "JUDGE" | "REVIEWER"; applicationId: string; target: number }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  async function go() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/assignments", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto", role, perApplication: Math.max(1, target), statuses: ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "FINALIST", "NOT_SELECTED", "WINNER"], applicationIds: [applicationId], dryRun: false }) });
      const d = await res.json();
      if (!res.ok) setMsg(d.message ?? "Could not reassign.");
      else if (!d.added) setMsg(d.shortfalls?.length ? "Nobody else is available. Add a person on the Staff page." : "Already covered.");
      else router.refresh();
    } catch { setMsg("Could not reach the server."); } finally { setBusy(false); }
  }
  return <div className="text-right"><button type="button" disabled={busy} onClick={go} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Reassigning…" : "Give to someone else"}</button>{msg && <p className="mt-1 text-xs font-semibold">{msg}</p>}</div>;
}
