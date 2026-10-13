"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PanelReview } from "@/types/review";

const LABEL: Record<string, string> = { ASSIGNED: "Not started", IN_PROGRESS: "In progress", SUBMITTED: "Submitted", CONFLICT: "Conflict declared", WITHDRAWN: "Withdrawn" };

/** Admin view of everyone's score sheet for ONE application, plus manual assign / withdraw / reopen. */
export function PanelReviewsAdmin({ applicationId, reviews, panelists, criteria, canManage }: {
  applicationId: string; reviews: PanelReview[]; panelists: Array<{ email: string; name: string; role: string }>;
  criteria: Array<{ id: string; name: string }>; canManage: boolean;
}) {
  const router = useRouter();
  const [who, setWho] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const taken = new Set(reviews.filter((r) => r.status !== "WITHDRAWN").map((r) => r.panelEmail));
  const free = panelists.filter((p) => !taken.has(p.email));

  async function call(method: "POST" | "PATCH", body: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/assignments", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ tone: "err", text: d.message ?? "That did not work." }); else { setMsg({ tone: "ok", text: ok }); setWho(""); router.refresh(); }
    } catch { setMsg({ tone: "err", text: "Could not reach the server." }); } finally { setBusy(false); }
  }
  const visible = reviews.filter((r) => r.status !== "WITHDRAWN");
  const avg = (() => { const t = visible.filter((r) => r.status === "SUBMITTED" && r.total != null).map((r) => r.total as number); return t.length ? Math.round((t.reduce((a, b) => a + b, 0) / t.length) * 100) / 100 : null; })();

  return (
    <section className="break-inside-avoid rounded-lg border border-paper-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-line px-5 py-3">
        <h2 className="font-display text-lg font-extrabold">Panel reviews</h2>
        <p className="text-sm">{avg != null ? <>Average of submitted: <strong className="font-display text-xl tabular-nums">{avg}</strong>/100</> : <span className="text-ink-muted">No submitted scores yet</span>}</p>
      </div>
      <div className="space-y-4 px-5 py-4">
        {visible.length === 0 ? <p className="text-sm text-ink-muted">Not assigned to anyone yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-ink-muted"><tr><th className="py-2 pr-3">Person</th><th className="py-2 pr-3">Status</th>{criteria.map((c) => <th key={c.id} className="py-2 pr-2" title={c.name}>{c.name.split(" ")[0]}</th>)}<th className="py-2 pr-3">Total</th><th className="py-2">{canManage ? "Action" : ""}</th></tr></thead>
              <tbody className="divide-y divide-paper-line">{visible.map((r) => (
                <tr key={r.reviewId} className="align-top">
                  <td className="py-2.5 pr-3"><strong>{r.panelName}</strong><span className="block text-xs text-ink-muted">{r.panelRole === "JUDGE" ? "Judge" : "Reviewer"} · {r.panelEmail}</span>
                    {r.overallComment && <p className="mt-1 max-w-md whitespace-pre-wrap text-xs text-ink-soft">“{r.overallComment}”</p>}
                    {Object.entries(r.comments).map(([k, v]) => <p key={k} className="max-w-md text-xs text-ink-muted"><em>{criteria.find((c) => c.id === k)?.name}:</em> {v}</p>)}
                    {r.status === "CONFLICT" && <p className="mt-1 text-xs font-semibold text-warn-fg">Conflict: “{r.conflictNote}”</p>}</td>
                  <td className="py-2.5 pr-3 text-xs font-semibold">{LABEL[r.status]}</td>
                  {criteria.map((c) => <td key={c.id} className="py-2.5 pr-2 tabular-nums">{r.scores[c.id] ?? "–"}</td>)}
                  <td className="py-2.5 pr-3 font-bold tabular-nums">{r.status === "SUBMITTED" ? r.total : "–"}</td>
                  <td className="py-2.5">{canManage && (r.status === "SUBMITTED"
                    ? <button type="button" disabled={busy} onClick={() => call("PATCH", { reviewId: r.reviewId, action: "reopen" }, `Reopened for ${r.panelName}.`)} className="text-xs font-semibold text-azure underline">Reopen</button>
                    : r.status !== "CONFLICT" && <button type="button" disabled={busy} onClick={() => call("PATCH", { reviewId: r.reviewId, action: "withdraw" }, `Taken away from ${r.panelName}.`)} className="text-xs font-semibold text-danger-fg underline">Withdraw</button>)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {canManage && (
          <div className="flex flex-wrap items-end gap-3 border-t border-paper-line pt-4">
            <label className="text-sm font-semibold">Give this application to
              <select value={who} onChange={(e) => setWho(e.target.value)} className="mt-1 block w-72 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-normal">
                <option value="">Choose a judge or reviewer…</option>
                {["REVIEWER", "JUDGE"].map((role) => { const list = free.filter((p) => p.role === role); return list.length ? <optgroup key={role} label={role === "JUDGE" ? "Judges" : "Reviewers"}>{list.map((p) => <option key={p.email} value={p.email}>{p.name} ({p.email})</option>)}</optgroup> : null; })}
              </select></label>
            <button type="button" disabled={!who || busy} onClick={() => call("POST", { mode: "one", applicationId, panelEmail: who }, "Assigned.")} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Assign</button>
          </div>
        )}
        {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm font-semibold ${msg.tone === "err" ? "bg-danger-bg text-danger-fg" : "bg-lime/40 text-night"}`}>{msg.text}</p>}
      </div>
    </section>
  );
}
