"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { L2_DECISIONS, L2_MAX_TOTAL, L2_REVIEW_QUESTIONS, L2_SCALE, type L2Decision } from "@/config/level2Review";

type Initial = { scores: Record<string, number>; decision: L2Decision | null; comment: string; status: string; total: number | null };

/** Five questions (tap 1–5), one decision, one short reason. Save draft, or Submit (then it is locked). */
export function Level2ReviewForm({ code, initial, open, nextHref }: { code: string; initial: Initial; open: boolean; nextHref: string | null }) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(initial.scores);
  const [decision, setDecision] = useState<L2Decision | null>(initial.decision);
  const [comment, setComment] = useState(initial.comment);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const top = useRef<HTMLElement>(null);
  const submitted = initial.status === "SUBMITTED";
  const locked = submitted || !open;
  const answered = L2_REVIEW_QUESTIONS.filter((q) => scores[q.id]).length;
  const total = L2_REVIEW_QUESTIONS.reduce((n, q) => n + (scores[q.id] ?? 0), 0);

  useEffect(() => {   // warn before leaving with unsaved answers
    if (!dirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const change = (fn: () => void, field: string) => { fn(); setDirty(true); setMsg(null); setErrors((e) => { if (!e[field]) return e; const { [field]: _x, ...rest } = e; return rest; }); };

  async function save(submit: boolean) {
    if (busy) return;
    if (submit && !window.confirm("Submit this review? You cannot change it afterwards.")) return;
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
    } catch { setMsg({ tone: "err", text: "We could not reach the server. Your answers are still on this page: check your connection and try again." }); }
    finally { setBusy(false); }
  }

  const err = (k: string) => errors[k] && <p id={`e-${k}`} role="alert" className="mt-1.5 text-sm font-medium text-danger-fg">{errors[k]}</p>;
  const focus = "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

  return (
    <section ref={top} aria-labelledby="score-h" className="scroll-mt-6 rounded-lg border border-paper-line bg-white">
      <div className="flex items-baseline justify-between gap-3 border-b border-paper-line px-5 py-3">
        <h2 id="score-h" className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Your review</h2>
        <p className="text-sm tabular-nums text-ink-soft" aria-live="polite">{answered === L2_REVIEW_QUESTIONS.length ? <><strong className="text-forest-900">{total}</strong> / {L2_MAX_TOTAL}</> : `${answered} of ${L2_REVIEW_QUESTIONS.length} answered`}</p>
      </div>

      {submitted && (
        <div role="status" className="mx-5 mt-4 rounded-md bg-leaf-50 px-4 py-3 text-sm text-forest-900">
          <strong>Submitted.</strong> {initial.total != null && `${initial.total} / ${L2_MAX_TOTAL} · `}{L2_DECISIONS.find((d) => d.value === initial.decision)?.label}
          {nextHref ? <> · <Link href={nextHref} className="font-semibold text-primary underline">Next applicant →</Link></> : <> · <Link href="/review/level-2" className="font-semibold text-primary underline">Back to my list</Link></>}
        </div>
      )}

      <ol className="divide-y divide-paper-line">
        {L2_REVIEW_QUESTIONS.map((q, i) => (
          <li key={q.id} id={`q-${q.id}`} className="scroll-mt-24 px-5 py-4">
            <p id={`l-${q.id}`} className="font-medium text-forest-900"><span className="mr-2 tabular-nums text-ink-muted">{i + 1}.</span>{q.label}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{q.hint}</p>
            <div role="radiogroup" aria-labelledby={`l-${q.id}`} aria-describedby={errors[q.id] ? `e-${q.id}` : undefined} className="mt-3 flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = scores[q.id] === n;
                return (
                  <button key={n} type="button" role="radio" aria-checked={on} aria-label={`${n}: ${L2_SCALE[n]}`} disabled={locked || busy}
                    onClick={() => change(() => setScores((s) => ({ ...s, [q.id]: n })), q.id)}
                    className={`h-11 flex-1 rounded-md border text-base font-semibold tabular-nums transition-colors sm:max-w-[64px] ${focus} ${on ? "border-primary bg-primary text-white" : "border-paper-line bg-white text-forest-900 hover:border-primary"} disabled:cursor-default ${!on && locked ? "opacity-50" : ""}`}>{n}</button>
                );
              })}
            </div>
            <p className="mt-1.5 h-5 text-sm text-ink-soft">{scores[q.id] ? L2_SCALE[scores[q.id]] : <span className="text-ink-muted">1 very weak · 5 strong</span>}</p>
            {err(q.id)}
          </li>
        ))}
        <li id="q-decision" className="scroll-mt-24 px-5 py-4">
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
        </li>
        <li id="q-comment" className="scroll-mt-24 px-5 py-4">
          <label htmlFor="l2-comment" className="font-medium text-forest-900">Why?</label>
          <p className="mt-0.5 text-sm text-ink-muted">One or two sentences for the programme team.</p>
          <textarea id="l2-comment" rows={3} maxLength={1000} value={comment} readOnly={locked || busy} onChange={(e) => change(() => setComment(e.target.value), "comment")}
            aria-invalid={!!errors.comment} aria-describedby={errors.comment ? "e-comment" : undefined}
            className={`input-base mt-2 resize-y leading-relaxed ${errors.comment ? "input-error" : ""} ${locked ? "bg-neutral-50" : ""}`} />
          {err("comment")}
        </li>
      </ol>

      {!locked && (
        <div className="flex flex-col-reverse gap-3 border-t border-paper-line px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`text-sm font-medium sm:mr-auto ${msg.tone === "err" ? "text-danger-fg" : "text-primary"}`}>{msg.text}</p>}
          <button type="button" disabled={busy} onClick={() => void save(false)} className={`min-h-[44px] rounded-full border border-paper-line bg-white px-6 text-sm font-semibold text-forest-900 hover:border-primary disabled:opacity-50 ${focus}`}>{busy ? "Saving…" : "Save draft"}</button>
          <button type="button" disabled={busy} onClick={() => void save(true)} className={`min-h-[44px] rounded-full bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 ${focus}`}>Submit review</button>
        </div>
      )}
      {!open && !submitted && <p className="border-t border-paper-line px-5 py-4 text-sm text-ink-muted">Reviews are closed at the moment. Your answers so far are kept.</p>}
      {submitted && msg?.tone === "ok" && <p role="status" className="sr-only">{msg.text}</p>}
    </section>
  );
}
