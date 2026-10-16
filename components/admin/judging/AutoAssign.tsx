"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = { pool: number; people: number; creates: number; applied: boolean; added?: number; shortfalls: Array<{ applicationId: string; missing: number }>; loadAfter: Array<{ email: string; name: string; before: number; after: number }> };
const STATUS_OPTIONS = [["SUBMITTED", "Submitted"], ["UNDER_REVIEW", "Under review"], ["SHORTLISTED", "Shortlisted"], ["FINALIST", "Finalist"]] as const;

export function AutoAssign({ role, valueChains, states }: { role: "JUDGE" | "REVIEWER"; valueChains: Array<{ value: string; label: string }>; states: string[] }) {
  const router = useRouter();
  const [per, setPer] = useState(2);
  const [statuses, setStatuses] = useState<string[]>(role === "JUDGE" ? ["SHORTLISTED", "FINALIST"] : ["SUBMITTED", "UNDER_REVIEW"]);
  const [chain, setChain] = useState(""); const [state, setState] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/assignments", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto", role, perApplication: per, statuses, valueChains: chain ? [chain] : [], states: state ? [state] : [], dryRun }) });
      const d = await res.json();
      if (!res.ok) { setPlan(null); setMsg({ tone: "err", text: `${d.message ?? "That did not work."}${d.code ? ` (code ${d.code}${d.ref ? `, ref ${d.ref}: find this ref in the server log` : ""})` : ""}` }); return; }
      setPlan(d);
      if (!dryRun) { setMsg({ tone: "ok", text: `Done: ${d.added} new assignment(s) created. The people can see them now.` }); setPlan(null); router.refresh(); }
    } catch { setMsg({ tone: "err", text: "Could not reach the server." }); } finally { setBusy(false); }
  }
  const toggle = (v: string) => { setStatuses((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v])); setPlan(null); };
  const select = "mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <label className="text-sm font-semibold">{role === "JUDGE" ? "Judges" : "Reviewers"} per application
          <input type="number" min={1} max={10} value={per} onChange={(e) => { setPer(Math.max(1, Math.min(10, Number(e.target.value) || 1))); setPlan(null); }} className={select} /></label>
        <fieldset className="text-sm font-semibold md:col-span-1"><legend>Applications with status</legend>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-normal">{STATUS_OPTIONS.map(([v, l]) => <label key={v} className="flex items-center gap-1.5"><input type="checkbox" checked={statuses.includes(v)} onChange={() => toggle(v)} className="accent-primary" />{l}</label>)}</div></fieldset>
        <label className="text-sm font-semibold">Only this value chain <span className="font-normal text-ink-muted">(optional)</span>
          <select value={chain} onChange={(e) => { setChain(e.target.value); setPlan(null); }} className={select}><option value="">All value chains</option>{valueChains.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}</select></label>
        <label className="text-sm font-semibold">Only this state <span className="font-normal text-ink-muted">(optional)</span>
          <select value={state} onChange={(e) => { setState(e.target.value); setPlan(null); }} className={select}><option value="">All states</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
      </div>
      <button type="button" disabled={busy || !statuses.length} onClick={() => run(true)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy && !plan ? "Working…" : "Preview"}</button>

      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm font-semibold ${msg.tone === "err" ? "bg-danger-bg text-danger-fg" : "bg-lime/40 text-night"}`}>{msg.text}</p>}

      {plan && (
        <div className="rounded-lg border-2 border-primary p-4" aria-live="polite">
          <p className="font-semibold">{plan.creates === 0 ? `Nothing to do: all ${plan.pool} matching application(s) already have ${per} ${role === "JUDGE" ? "judge" : "reviewer"}(s).` : `This will create ${plan.creates} assignment(s) for ${plan.pool} matching application(s), shared between ${plan.people} people.`}</p>
          {plan.shortfalls.length > 0 && <p className="mt-1 text-sm text-warn-fg">{plan.shortfalls.length} application(s) cannot get {per} different people (not enough people without a conflict). Add more people or lower the number. First few: {plan.shortfalls.slice(0, 5).map((s) => s.applicationId).join(", ")}</p>}
          {plan.creates > 0 && (
            <>
              <div className="mt-3 max-h-64 overflow-auto rounded-md border border-paper-line">
                <table className="w-full text-sm"><thead className="sticky top-0 bg-paper-warm text-left text-xs text-ink-muted"><tr><th className="px-3 py-2">Person</th><th className="px-3 py-2">Now</th><th className="px-3 py-2">After</th></tr></thead>
                  <tbody className="divide-y divide-paper-line">{plan.loadAfter.map((p) => <tr key={p.email}><td className="px-3 py-1.5">{p.name} <span className="text-ink-muted">{p.email}</span></td><td className="px-3 py-1.5 tabular-nums">{p.before}</td><td className="px-3 py-1.5 font-semibold tabular-nums">{p.after}{p.after > p.before ? <span className="ml-1 text-xs text-primary">(+{p.after - p.before})</span> : null}</td></tr>)}</tbody></table>
              </div>
              <div className="mt-3 flex gap-3"><button type="button" disabled={busy} onClick={() => run(false)} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Assigning…" : `Confirm and assign ${plan.creates}`}</button><button type="button" onClick={() => setPlan(null)} className="rounded-full border border-paper-line px-5 py-2 text-sm font-semibold">Cancel</button></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
