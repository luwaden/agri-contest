"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postScreening } from "./post";

type Plan = { pool: number; people: number; creates: number; applied: boolean; added?: number; shortfalls: unknown[] };

/** Step 4: every application a reviewer passed goes to the judges (fills gaps only, so it is safe to press again). */
export function SendToJudges({ passed, judges }: { passed: number; judges: number }) {
  const router = useRouter();
  const [per, setPer] = useState(Math.min(3, Math.max(1, judges)));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(dryRun: boolean) {
    setBusy(true); setMsg(null);
    const r = await postScreening<Plan>({ action: "judges", perApplication: per, dryRun });
    setBusy(false);
    if (!r.ok) { setPlan(null); setMsg({ tone: "err", text: r.error }); return; }
    if (dryRun) { setPlan(r.data); return; }
    setPlan(null); setMsg({ tone: "ok", text: `Done. ${r.data.added} judge assignment(s) created.` }); router.refresh();
  }
  if (!judges) return <p className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-fg">There are no judges yet. Add them on the Staff page (role: Judge).</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Judges per application
          <input type="number" min={1} max={Math.min(10, judges)} value={per} onChange={(e) => { setPer(Math.max(1, Math.min(10, judges, Number(e.target.value) || 1))); setPlan(null); }} className="mt-1 block w-28 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums" /></label>
        <button type="button" disabled={busy || !passed} onClick={() => run(true)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy && !plan ? "Working…" : `Preview: send ${passed} to judges`}</button>
      </div>
      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm font-semibold ${msg.tone === "err" ? "bg-danger-bg text-danger-fg" : "bg-lime/40 text-night"}`}>{msg.text}</p>}
      {plan && <div className="rounded-lg border-2 border-primary p-4 text-sm" aria-live="polite">
        <p className="font-semibold">{plan.creates ? `${plan.creates} assignment(s) for ${plan.pool} passed application(s), shared between ${plan.people} judge(s).` : `Nothing to do: all ${plan.pool} already have ${per} judge(s).`}</p>
        {plan.shortfalls.length > 0 && <p className="mt-1 text-warn-fg">{plan.shortfalls.length} application(s) cannot get {per} different judges. Lower the number or add judges.</p>}
        {plan.creates > 0 && <div className="mt-3 flex gap-3"><button type="button" disabled={busy} onClick={() => run(false)} className="rounded-full bg-primary px-5 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Assigning…" : "Confirm"}</button><button type="button" onClick={() => setPlan(null)} className="rounded-full border border-paper-line px-5 py-2 font-semibold">Cancel</button></div>}
      </div>}
    </div>
  );
}
