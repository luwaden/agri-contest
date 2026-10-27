"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { L2_CRITERIA, L2_DECISIONS, L2_GROUPS, L2_MAX_MARKS, l2Percent, type L2Decision } from "@/config/level2Review";

type Initial = { scores: Record<string, number>; decision: L2Decision | null; comment: string; status: string; total: number | null; percent: number | null; legacyTotal: number | null };
const byId = new Map(L2_CRITERIA.map((c) => [c.id, c]));

/** The marking sheet: a mark per criterion (out of 80, shown as %), one decision, one short reason. Save draft, or Submit (then it is locked). */
export function Level2ReviewForm({ code, initial, open, nextHref, missingDocs }: { code: string; initial: Initial; open: boolean; nextHref: string | null; missingDocs: string[] }) {
  const router = useRouter();
  const noDoc = new Set(missingDocs);
  const [scores, setScores] = useState<Record<string, number>>(() => ({ ...initial.scores, ...Object.fromEntries(missingDocs.map((id) => [id, 0])) }));
  const [decision, setDecision] = useState<L2Decision | null>(initial.decision);
  const [comment, setComment] = useState(initial.comment);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const top = useRef<HTMLElement>(null);
  const submitted = initial.status === "SUBMITTED";
  const locked = submitted || !open;
  const marked = L2_CRITERIA.filter((c) => scores[c.id] !== undefined).length;
  const total = L2_CRITERIA.reduce((n, c) => n + (scores[c.id] ?? 0), 0);
  const complete = marked === L2_CRITERIA.length;

  useEffect(() => {   // warn before leaving with unsaved marks
    if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const change = (fn: () => void, field: string) => { fn(); setDirty(true); setMsg(null); setErrors((e) => { if (!e[field]) return e; const { [field]: _x, ...rest } = e; return rest; }); };
  const setMark = (id: string, v: number | undefined) => change(() => setScores((s) => { const n = { ...s }; if (v === undefined) delete n[id]; else n[id] = v; return n; }), id);

  async function save(submit: boolean) {
    if (busy) return;
    if (submit && !window.confirm(`Submit this review (${complete ? `${l2Percent(total)}%` : "incomplete"})? You cannot change it afterwards.`)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/panel/level-2/${code}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scores, decision, comment, submit }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(d.errors ?? {}); setMsg({ tone: "err", text: d.message ?? "That did not save. Please try again." });
        const first = Object.keys(d.errors ?? {})[0];
        if (first) requestAnimationFrame(() => document.getElementById(`q-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
        return;
      }
      setErrors({}); setDirty(false);
      setMsg({ tone: "ok", text: submit ? "Review submitted. Thank you." : "Draft saved." });
      router.refresh();
      if (submit) requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch { setMsg({ tone: "err", text: "We could not reach the server. Your marks are still on this page: check your connection and try again." }); }
    finally { setBusy(false); }
  }

  const err = (k: string) => errors[k] && <p id={`e-${k}`} role="alert" className="mt-1.5 text-sm font-medium text-danger-fg">{errors[k]}</p>;
  const focus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
  const step = "flex h-10 w-10 items-center justify-center rounded-md border border-paper-line bg-white text-lg text-forest-900 hover:border-primary disabled:opacity-40 disabled:hover:border-paper-line";

  return (
    <section ref={top} aria-labelledby="score-h" className="scroll-mt-6 rounded-lg border border-paper-line bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-paper-line px-5 py-3">
        <h2 id="score-h" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Your marks</h2>
        <p className="text-sm tabular-nums text-ink-soft" aria-live="polite">
          {complete ? <><strong className="text-base text-forest-900">{l2Percent(total)}%</strong> <span className="text-ink-muted">· {total} / {L2_MAX_MARKS}</span></> : `${marked} of ${L2_CRITERIA.length} marked`}
        </p>
      </div>

      {submitted && (
        <div role="status" className="mx-5 mt-4 rounded-md bg-leaf-50 px-4 py-3 text-sm text-forest-900">
          <strong>Submitted.</strong> {initial.percent != null && `${initial.percent}% · `}{L2_DECISIONS.find((d) => d.value === initial.decision)?.label}
          {nextHref ? <> · <Link href={nextHref} className="font-semibold text-primary underline">Next applicant →</Link></> : <> · <Link href="/review/level-2" className="font-semibold text-primary underline">Back to my list</Link></>}
        </div>
      )}
      {!submitted && initial.legacyTotal != null && (
        <p className="mx-5 mt-4 rounded-md bg-paper-warm px-4 py-3 text-sm text-ink-soft">You marked this applicant on the earlier form ({initial.legacyTotal} / 25). Please mark it again on this sheet.</p>
      )}

      {L2_GROUPS.map((g) => (
        <fieldset key={g.title} className="border-b border-paper-line last:border-b-0">
          <legend className="flex w-full items-baseline justify-between gap-3 px-5 pt-4 text-sm font-semibold text-forest-900">
            <span>{g.title}</span>{g.note && <span className="text-xs font-normal text-ink-muted">{g.note}</span>}
          </legend>
          <ul className="divide-y divide-paper-line/70">
            {g.ids.map((id) => {
              const c = byId.get(id)!; const v = scores[id]; const fixed = noDoc.has(id);
              return (
                <li key={id} id={`q-${id}`} className="scroll-mt-24 px-5 py-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <label htmlFor={`m-${id}`} className="font-medium text-forest-900">{c.label}</label>
                      <p className="mt-0.5 text-sm text-ink-muted">{fixed ? "Not provided by the applicant, so it scores 0." : c.hint}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button type="button" aria-label={`Lower ${c.label}`} disabled={locked || busy || fixed || !v} onClick={() => setMark(id, Math.max(0, (v ?? 0) - 1))} className={`${step} ${focus}`}>−</button>
                      <input id={`m-${id}`} inputMode="numeric" autoComplete="off" value={v ?? ""} readOnly={locked || busy || fixed}
                        onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 2); setMark(id, d === "" ? undefined : Math.min(c.max, Number(d))); }}
                        aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `e-${id}` : undefined}
                        className={`h-10 w-14 rounded-md border text-center text-base font-semibold tabular-nums text-forest-900 ${focus} ${errors[id] ? "border-danger-fg" : "border-paper-line"} ${locked || fixed ? "bg-neutral-50" : "bg-white"}`} />
                      <button type="button" aria-label={`Raise ${c.label}`} disabled={locked || busy || fixed || v === c.max} onClick={() => setMark(id, Math.min(c.max, (v ?? -1) + 1))} className={`${step} ${focus}`}>+</button>
                      <span className="w-10 pl-1 text-sm tabular-nums text-ink-muted">/ {c.max}</span>
                    </div>
                  </div>
                  {err(id)}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}

      <div className="border-t border-paper-line">
        <div id="q-decision" className="scroll-mt-24 px-5 py-4">
          <p id="l-decision" className="font-medium text-forest-900">Your decision</p>
          <div role="radiogroup" aria-labelledby="l-decision" className="mt-3 grid grid-cols-2 gap-2">
            {L2_DECISIONS.map((d) => {
              const on = decision === d.value;
              return (
                <button key={d.value} type="button" role="radio" aria-checked={on} disabled={locked || busy} onClick={() => change(() => setDecision(d.value), "decision")}
                  className={`min-h-[48px] rounded-md border px-3 text-[15px] font-semibold transition-colors ${focus} ${on ? (d.value === "RECOMMEND" ? "border-primary bg-primary text-white" : "border-forest-900 bg-forest-900 text-white") : "border-paper-line bg-white text-forest-900 hover:border-primary"} ${!on && locked ? "opacity-50" : ""}`}>{d.label}</button>
              );
            })}
          </div>
          {err("decision")}
        </div>
        <div id="q-comment" className="scroll-mt-24 border-t border-paper-line px-5 py-4">
          <label htmlFor="l2-comment" className="font-medium text-forest-900">Comment</label>
          <p className="mt-0.5 text-sm text-ink-muted">One or two sentences for the programme team.</p>
          <textarea id="l2-comment" rows={3} maxLength={1000} value={comment} readOnly={locked || busy} onChange={(e) => change(() => setComment(e.target.value), "comment")}
            aria-invalid={!!errors.comment} aria-describedby={errors.comment ? "e-comment" : undefined}
            className={`input-base mt-2 resize-y leading-relaxed ${errors.comment ? "input-error" : ""} ${locked ? "bg-neutral-50" : ""}`} />
          {err("comment")}
        </div>
      </div>

      {!locked && (
        <div className="flex flex-col-reverse gap-3 border-t border-paper-line px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`text-sm font-medium sm:mr-auto ${msg.tone === "err" ? "text-danger-fg" : "text-primary"}`}>{msg.text}</p>}
          <button type="button" disabled={busy} onClick={() => void save(false)} className={`min-h-[44px] rounded-full border border-paper-line bg-white px-6 text-sm font-semibold text-forest-900 hover:border-primary disabled:opacity-50 ${focus}`}>{busy ? "Saving…" : "Save draft"}</button>
          <button type="button" disabled={busy} onClick={() => void save(true)} className={`min-h-[44px] rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 ${focus}`}>Submit review</button>
        </div>
      )}
      {!open && !submitted && <p className="border-t border-paper-line px-5 py-4 text-sm text-ink-muted">Reviews are closed at the moment. Your marks so far are kept.</p>}
      {submitted && msg?.tone === "ok" && <p role="status" className="sr-only">{msg.text}</p>}
    </section>
  );
}
