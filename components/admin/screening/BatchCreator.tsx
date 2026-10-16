"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postScreening } from "./post";

type Person = { email: string; name: string; assigned: number };
type Preview = {
  picked: number; alreadyAssigned: number; creates: number; shortfalls: number; bySpread: number; perReviewer: number; lowestScore: number | null; applied: boolean; added?: number;
  groups: Array<{ label: string; min: number; got: number; available: number }>;
  loadAfter: Array<{ email: string; name: string; before: number; after: number }>;
};

/** Step 2: choose the batch size and the reviewers, preview, confirm. */
export function BatchCreator({ reviewers, shortlistDefault, batchDefault }: { reviewers: Person[]; shortlistDefault: number; batchDefault: number }) {
  const router = useRouter();
  const [shortlist, setShortlist] = useState(shortlistDefault);
  const [size, setSize] = useState(batchDefault);
  const [chosen, setChosen] = useState<string[]>(reviewers.map((r) => r.email));
  const [plan, setPlan] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    setBusy(true); setMsg(null);
    const r = await postScreening<Preview>({ action: "batch", shortlistSize: shortlist, size, reviewerEmails: chosen, dryRun });
    setBusy(false);
    if (!r.ok) { setPlan(null); setMsg({ tone: "err", text: r.error }); return; }
    if (dryRun) { setPlan(r.data); return; }
    setPlan(null); setMsg({ tone: "ok", text: `Done. ${r.data.added} application(s) shared between ${chosen.length} reviewer(s). They can start now.` }); router.refresh();
  }
  const toggle = (e: string) => { setChosen((c) => (c.includes(e) ? c.filter((x) => x !== e) : [...c, e])); setPlan(null); };
  const input = "mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums";

  if (!reviewers.length) return <p className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-fg">There are no reviewers yet. Add them on the Staff page (role: Reviewer), then come back.</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-semibold">Take from the top
          <input type="number" min={1} value={shortlist} onChange={(e) => { setShortlist(Math.max(1, Number(e.target.value) || 1)); setPlan(null); }} className={input} />
          <span className="mt-1 block text-xs font-normal text-ink-muted">The shortlist from step 1.</span></label>
        <label className="text-sm font-semibold">Applications in this batch
          <input type="number" min={1} value={size} onChange={(e) => { setSize(Math.max(1, Number(e.target.value) || 1)); setPlan(null); }} className={input} />
          <span className="mt-1 block text-xs font-normal text-ink-muted">About {Math.ceil(size / Math.max(1, chosen.length))} each for {chosen.length} reviewer(s).</span></label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Reviewers ({chosen.length} of {reviewers.length} chosen)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {reviewers.map((r) => (
            <label key={r.email} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${chosen.includes(r.email) ? "border-primary bg-white" : "border-paper-line bg-paper-warm/40 text-ink-muted"}`}>
              <input type="checkbox" checked={chosen.includes(r.email)} onChange={() => toggle(r.email)} className="accent-primary" />
              <span className="min-w-0 flex-1 truncate"><strong className="font-semibold text-ink">{r.name}</strong> <span className="text-xs">{r.email}</span></span>
              {r.assigned > 0 && <span className="text-xs tabular-nums text-ink-muted">has {r.assigned}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="button" disabled={busy || !chosen.length} onClick={() => run(true)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy && !plan ? "Working…" : "Preview the batch"}</button>
      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm font-semibold ${msg.tone === "err" ? "bg-danger-bg text-danger-fg" : "bg-lime/40 text-night"}`}>{msg.text}</p>}

      {plan && (
        <div className="space-y-3 rounded-lg border-2 border-primary p-4" aria-live="polite">
          <p className="font-semibold">
            {plan.picked} application(s) picked from the top {shortlist}{plan.lowestScore != null ? ` (lowest pre-score ${plan.lowestScore})` : ""}.
            {plan.bySpread > 0 && ` ${plan.bySpread} of them came in to keep the spread fair; the rest are strictly by rank.`}
            {plan.alreadyAssigned > 0 && ` ${plan.alreadyAssigned} already have a reviewer and stay where they are.`}
          </p>
          {plan.creates === 0 ? <p className="text-sm">Nothing new to assign.</p> : <p className="text-sm">This gives out <strong>{plan.creates}</strong> application(s), about {plan.perReviewer} per reviewer.</p>}
          {plan.shortfalls > 0 && <p className="text-sm text-warn-fg">{plan.shortfalls} application(s) could not be given to anyone (for example, a reviewer's own application). Add a reviewer and preview again.</p>}

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="max-h-72 overflow-auto rounded-md border border-paper-line">
              <table className="w-full text-sm"><caption className="sr-only">Applications per reviewer</caption>
                <thead className="sticky top-0 bg-paper-warm text-left text-xs text-ink-muted"><tr><th className="px-3 py-2">Reviewer</th><th className="px-3 py-2 text-right">Now</th><th className="px-3 py-2 text-right">After</th></tr></thead>
                <tbody className="divide-y divide-paper-line">{plan.loadAfter.map((p) => <tr key={p.email}><td className="px-3 py-1.5">{p.name}</td><td className="px-3 py-1.5 text-right tabular-nums">{p.before}</td><td className="px-3 py-1.5 text-right font-semibold tabular-nums">{p.after}</td></tr>)}</tbody></table>
            </div>
            <div className="max-h-72 overflow-auto rounded-md border border-paper-line">
              <table className="w-full text-sm"><caption className="sr-only">Spread of the batch</caption>
                <thead className="sticky top-0 bg-paper-warm text-left text-xs text-ink-muted"><tr><th className="px-3 py-2">Group</th><th className="px-3 py-2 text-right">In batch</th><th className="px-3 py-2 text-right">Minimum</th><th className="px-3 py-2 text-right">In shortlist</th></tr></thead>
                <tbody className="divide-y divide-paper-line">{plan.groups.map((g) => <tr key={g.label}><td className="px-3 py-1.5">{g.label}</td><td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${g.got < g.min ? "text-danger-fg" : ""}`}>{g.got}</td><td className="px-3 py-1.5 text-right tabular-nums text-ink-muted">{g.min}</td><td className="px-3 py-1.5 text-right tabular-nums text-ink-muted">{g.available}</td></tr>)}</tbody></table>
            </div>
          </div>
          {plan.creates > 0 && <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => run(false)} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Assigning…" : `Confirm and assign ${plan.creates}`}</button>
            <button type="button" onClick={() => setPlan(null)} className="rounded-full border border-paper-line px-5 py-2 text-sm font-semibold">Cancel</button></div>}
        </div>
      )}
    </div>
  );
}
