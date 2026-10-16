"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Reviewer: pass this application to the next stage (or take the pass back). The server enforces the limit. */
export function PassButton({ applicationId, passed: initialPassed, count, limit, size = "md" }: { applicationId: string; passed: boolean; count: number; limit: number; size?: "sm" | "md" }) {
  const router = useRouter();
  const [passed, setPassed] = useState(initialPassed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const full = !passed && count >= limit;
  async function toggle() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/panel/reviews/${applicationId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pass: !passed }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(`${d.message ?? "That did not work."}${d.ref ? ` (ref ${d.ref})` : ""}`); return; }
      setPassed(d.decision === "PASS"); router.refresh();
    } catch { setErr("Could not reach the server."); } finally { setBusy(false); }
  }
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={toggle} disabled={busy || full} aria-pressed={passed}
        title={full ? `You have passed ${limit}. Remove a pass to pass this one.` : undefined}
        className={`rounded-full border font-semibold transition-colors disabled:opacity-50 ${pad} ${passed ? "border-primary bg-primary text-white hover:bg-primary/90" : "border-primary bg-white text-primary hover:bg-primary/5"}`}>
        {busy ? "Saving…" : passed ? "✓ Passed (remove)" : full ? `Limit of ${limit} reached` : "Pass to next stage"}
      </button>
      {err && <p role="alert" className="max-w-xs text-xs text-danger-fg">{err}</p>}
    </div>
  );
}
