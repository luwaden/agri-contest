"use client";
import { useState } from "react";
import { ACTIVE_STATUS_TRANSITIONS, STATUSES } from "@/config/programme";

export function StatusSelect({ id, status, onChanged }: { id: string; status: string; onChanged?: (s: string) => void }) {
  const [value, setValue] = useState(status); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const options = STATUSES.filter((s) => ACTIVE_STATUS_TRANSITIONS.includes(s.value) || s.value === status);
  async function change(next: string) {
    const prev = value; setValue(next); setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/admin/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!r.ok) throw new Error((await r.json()).message);
      setMsg("Status updated"); onChanged?.(next);
    } catch (e) { setValue(prev); setMsg((e as Error).message || "Could not update status."); } finally { setBusy(false); }
  }
  return (
    <span className="inline-flex flex-col">
      <label className="sr-only" htmlFor={`st-${id}`}>Change status for {id}</label>
      <select id={`st-${id}`} value={value} disabled={busy} onChange={(e) => change(e.target.value)} className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-600/25 disabled:opacity-60">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span role="status" className="min-h-[1rem] text-xs text-ink-muted">{msg}</span>
    </span>
  );
}
