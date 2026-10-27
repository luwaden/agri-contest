"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Scored = { code: string; businessName: string; state: string; percent: number; decision: "RECOMMEND" | "NOT_RECOMMEND" | null };
type Pick = { code: string; reason: string };
const ORD = ["1st", "2nd", "3rd"];

/** Three ranked slots: an applicant (from those already submitted, highest score first) and a reason for each. */
export function TopPicksForm({ need, scored, current, open, remaining }: { need: number; scored: Scored[]; current: Pick[]; open: boolean; remaining: number }) {
  const router = useRouter();
  const [picks, setPicks] = useState<Pick[]>(() => Array.from({ length: need }, (_, i) => {
    const c = current[i]; return c && scored.some((s) => s.code === c.code) ? { ...c } : { code: "", reason: c?.reason ?? "" };
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const byCode = new Map(scored.map((s) => [s.code, s]));
  const locked = !open || busy;

  const set = (i: number, patch: Partial<Pick>, field: string) => {
    setPicks((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x))); setMsg(null);
    setErrors((e) => { const { [field]: _x, ...rest } = e; return rest; });
  };
  const fillHighest = () => { setPicks((p) => p.map((x, i) => ({ ...x, code: scored[i]?.code ?? "" }))); setErrors({}); setMsg(null); };

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/panel/level-2/top-picks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ picks }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErrors(d.errors ?? {}); setMsg({ tone: "err", text: d.message ?? "That did not save. Please try again." }); return; }
      setErrors({}); setMsg({ tone: "ok", text: "Your top picks are saved." }); router.refresh();
    } catch { setMsg({ tone: "err", text: "We could not reach the server. Check your connection and try again." }); }
    finally { setBusy(false); }
  }

  const focus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  const err = (k: string) => errors[k] && <p id={`e-${k}`} role="alert" className="mt-1.5 text-sm font-medium text-danger-fg">{errors[k]}</p>;

  return (
    <div className="space-y-6">
      {remaining > 0 && <p className="rounded-md bg-paper-warm px-4 py-3 text-sm text-ink-soft">You still have {remaining} applicant{remaining === 1 ? "" : "s"} to review. You can change your picks after you finish.</p>}

      <section aria-labelledby="scores-h" className="rounded-lg border border-paper-line bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-paper-line px-5 py-3">
          <h2 id="scores-h" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Your scores</h2>
          {!locked && <button type="button" onClick={fillHighest} className={`text-sm font-semibold text-primary hover:underline ${focus}`}>Use my {need} highest</button>}
        </div>
        <ol className="max-h-72 divide-y divide-paper-line overflow-y-auto">
          {scored.map((s, i) => {
            const rank = picks.findIndex((p) => p.code === s.code);
            return (
              <li key={s.code} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-6 shrink-0 tabular-nums text-ink-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-forest-900">{s.businessName} <span className="text-ink-muted">· {s.state}</span></span>
                {rank >= 0 && <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-semibold text-primary">{ORD[rank]}</span>}
                <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-forest-900">{s.percent}%</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="picks-h" className="rounded-lg border border-paper-line bg-white">
        <h2 id="picks-h" className="border-b border-paper-line px-5 py-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Your picks</h2>
        <ol className="divide-y divide-paper-line">
          {picks.map((p, i) => {
            const chosen = byCode.get(p.code);
            return (
              <li key={i} className="px-5 py-4">
                <label htmlFor={`pick-${i}`} className="font-medium text-forest-900">{ORD[i]} choice</label>
                <select id={`pick-${i}`} value={p.code} disabled={locked} onChange={(e) => set(i, { code: e.target.value }, `pick${i}`)}
                  aria-invalid={!!errors[`pick${i}`]} aria-describedby={errors[`pick${i}`] ? `e-pick${i}` : undefined}
                  className={`input-base mt-2 ${errors[`pick${i}`] ? "input-error" : ""}`}>
                  <option value="">Choose an applicant…</option>
                  {scored.map((s) => <option key={s.code} value={s.code} disabled={picks.some((x, j) => j !== i && x.code === s.code)}>{s.businessName} · {s.percent}%</option>)}
                </select>
                {err(`pick${i}`)}
                {chosen && <p className="mt-1.5 text-sm text-ink-muted">{chosen.state} · {chosen.decision === "RECOMMEND" ? "You recommended" : "You did not recommend"} · {chosen.percent}%</p>}
                <label htmlFor={`reason-${i}`} className="mt-3 block text-sm font-medium text-forest-900">Why is this applicant in your top {need}?</label>
                <textarea id={`reason-${i}`} rows={2} maxLength={500} value={p.reason} readOnly={locked} onChange={(e) => set(i, { reason: e.target.value }, `reason${i}`)}
                  aria-invalid={!!errors[`reason${i}`]} aria-describedby={errors[`reason${i}`] ? `e-reason${i}` : undefined}
                  className={`input-base mt-1.5 resize-y leading-relaxed ${errors[`reason${i}`] ? "input-error" : ""} ${locked ? "bg-neutral-50" : ""}`} />
                {err(`reason${i}`)}
              </li>
            );
          })}
        </ol>
        {open ? (
          <div className="flex flex-col-reverse gap-3 border-t border-paper-line px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`text-sm font-medium sm:mr-auto ${msg.tone === "err" ? "text-danger-fg" : "text-primary"}`}>{msg.text}</p>}
            <button type="button" disabled={busy} onClick={() => void save()} className={`min-h-[44px] rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 ${focus}`}>{busy ? "Saving…" : "Save my top picks"}</button>
          </div>
        ) : <p className="border-t border-paper-line px-5 py-4 text-sm text-ink-muted">Reviews are closed at the moment. Your picks so far are kept.</p>}
      </section>
    </div>
  );
}
