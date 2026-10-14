"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SCORE_BANDS } from "@/config/scoring";
import type { ScoringCriterion } from "@/types/scoring";
import type { OwnReview } from "@/lib/services/reviewService";

const band = (n?: number) => (n ? SCORE_BANDS.find((b) => n >= b.min && n <= b.max) : undefined);
const MIN_OVERALL = 20;

/** The score sheet: 1–10 per criterion, optional notes, an overall comment, a live weighted total, and the conflict-of-interest route. */
export function ScoreSheet({ applicationId, applicantName, initial, criteria, backHref, nextHref }: {
  applicationId: string; applicantName: string; initial: OwnReview; criteria: ScoringCriterion[]; backHref: string; nextHref: string | null;
}) {
  const router = useRouter();
  const [review, setReview] = useState(initial);
  const [scores, setScores] = useState<Record<string, number>>(initial.scores ?? {});
  const [notes, setNotes] = useState<Record<string, string>>(initial.comments ?? {});
  const [openNote, setOpenNote] = useState<Record<string, boolean>>(Object.fromEntries(Object.keys(initial.comments ?? {}).map((k) => [k, true])));
  const [overall, setOverall] = useState(initial.overallComment ?? "");
  const [noConflict, setNoConflict] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [coiOpen, setCoiOpen] = useState(false);
  const [coiNote, setCoiNote] = useState("");

  const locked = review.status === "SUBMITTED" || review.status === "CONFLICT";
  const total = useMemo(() => {
    if (!criteria.every((c) => Number.isInteger(scores[c.id]))) return null;
    return Math.round(criteria.reduce((t, c) => t + (scores[c.id] / c.maximumScore) * c.weight, 0) * 100) / 100;
  }, [scores, criteria]);
  const scoredCount = criteria.filter((c) => Number.isInteger(scores[c.id])).length;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touch = () => { setDirty(true); setMsg(null); };
  async function send(method: "PUT" | "POST", body: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/panel/reviews/${applicationId}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(d.errors ?? {}); setMsg({ tone: "err", text: d.message ?? "That did not save. Please try again." });
        const first = Object.keys(d.errors ?? {})[0];   // take the person to the first thing to fix
        if (first) requestAnimationFrame(() => document.querySelector(`[data-field="${first.replace(/^comment_/, "")}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
        return null;
      }
      setErrors({}); setDirty(false); setReview(d.review); router.refresh(); return d.review as OwnReview;
    } catch { setMsg({ tone: "err", text: "We could not reach the server. Your scores are still on this page: check your connection and try again." }); return null; }
    finally { setBusy(false); }
  }
  const payload = () => ({ scores, comments: notes, overallComment: overall });
  const save = async () => { if (await send("PUT", payload())) setMsg({ tone: "ok", text: "Saved. You can come back and finish later." }); };
  const submit = async () => { setConfirming(false); const r = await send("PUT", { ...payload(), confirmNoConflict: noConflict, submit: true }); if (r) setMsg({ tone: "ok", text: `Submitted. Your total: ${r.total}/100.` }); };
  const declare = async () => { const r = await send("POST", { note: coiNote }); if (r) { setCoiOpen(false); setMsg({ tone: "ok", text: "Conflict recorded. The programme team will give this application to someone else." }); } };

  const err = (k: string) => errors[k] ? <p className="mt-1 text-xs font-semibold text-danger-fg">{errors[k]}</p> : null;

  if (review.status === "CONFLICT") {
    return (
      <aside className="rounded-card border border-paper-line bg-white p-6" aria-label="Score sheet">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">Score sheet</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-primary">Conflict declared</h2>
        <p className="mt-2 text-sm text-ink-soft">You told us: “{review.conflictNote}”. You will not score this application. The programme team will reassign it. Thank you for declaring it.</p>
        {msg && <p role="status" className="mt-3 rounded-md bg-lime/40 px-3 py-2 text-sm font-semibold text-night">{msg.text}</p>}
        <div className="mt-5 flex gap-3"><Link href={backHref} className="rounded-full border border-paper-line px-4 py-2 text-sm font-semibold text-primary">Back to list</Link>{nextHref && <Link href={nextHref} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">Next application →</Link>}</div>
      </aside>
    );
  }

  return (
    <aside className="rounded-card border border-paper-line bg-white" aria-label="Score sheet">
      <div className="flex items-start justify-between gap-4 rounded-t-card bg-primary px-6 py-4 text-white">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">Your score sheet</p>
          <p className="mt-0.5 text-sm text-white/90">{review.status === "SUBMITTED" ? `Submitted ${new Date(review.submittedAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : `${scoredCount} of ${criteria.length} scored`}</p></div>
        <div className="text-right"><p className="font-display text-4xl font-extrabold tabular-nums text-sun" aria-live="polite">{total ?? "–"}</p><p className="text-xs text-white/80">out of 100</p></div>
      </div>

      <div className="space-y-5 px-6 py-5">
        {criteria.map((c) => {
          const v = scores[c.id]; const bd = band(v);
          return (
            <fieldset key={c.id} data-field={c.id} className={`rounded-tile border p-3 ${errors[c.id] ? "border-danger-line bg-danger-bg/40" : "border-paper-line"}`}>
              <legend className="px-1 text-sm font-bold text-primary">{c.name} <span className="font-semibold text-ink-muted">· {c.weight}%</span></legend>
              <p className="text-xs text-ink-soft">{c.description}</p>
              <div role="radiogroup" aria-label={`${c.name} score`} className="mt-2 grid grid-cols-10 gap-1">
                {Array.from({ length: c.maximumScore }, (_, i) => i + 1).map((n) => (
                  <label key={n} className={`flex h-9 cursor-pointer items-center justify-center rounded-md border text-sm font-bold tabular-nums transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${v === n ? "border-primary bg-primary text-white" : "border-paper-line bg-white text-primary hover:border-primary"} ${locked ? "cursor-default opacity-80" : ""}`}>
                    <input type="radio" name={`score-${c.id}`} value={n} checked={v === n} disabled={locked} onChange={() => { setScores((s) => ({ ...s, [c.id]: n })); setErrors((e) => { const { [c.id]: _x, ...r } = e; return r; }); touch(); }} className="sr-only" />{n}
                  </label>
                ))}
              </div>
              <p className="mt-1 h-4 text-xs font-semibold text-ink-soft">{bd ? `${bd.band}: ${bd.text}` : ""}</p>
              {err(c.id)}
              {openNote[c.id] || notes[c.id] ? (
                <textarea aria-label={`Note on ${c.name}`} value={notes[c.id] ?? ""} disabled={locked} maxLength={1000} rows={2} placeholder="Why this score? (optional)"
                  onChange={(e) => { setNotes((s) => ({ ...s, [c.id]: e.target.value })); touch(); }} className="mt-2 w-full rounded-md border border-paper-line px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              ) : !locked && <button type="button" onClick={() => setOpenNote((s) => ({ ...s, [c.id]: true }))} className="mt-1 text-xs font-semibold text-azure underline">Add a note</button>}
              {err(`comment_${c.id}`)}
            </fieldset>
          );
        })}

        <div data-field="overallComment">
          <label htmlFor="overall" className="text-sm font-bold text-primary">Overall comment <span className="text-danger-fg">*</span></label>
          <p className="text-xs text-ink-soft">The main strengths and weaknesses, in a few sentences. The programme team may use it for feedback.</p>
          <textarea id="overall" value={overall} disabled={locked} rows={4} maxLength={3000} onChange={(e) => { setOverall(e.target.value); touch(); }}
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none ${errors.overallComment ? "border-danger-line" : "border-paper-line"}`} />
          {!locked && <p className={`text-right text-xs ${overall.trim().length < MIN_OVERALL ? "text-ink-muted" : "text-primary"}`}>{overall.trim().length < MIN_OVERALL ? `${MIN_OVERALL - overall.trim().length} more characters needed` : "✓"}</p>}
          {err("overallComment")}
        </div>

        {!locked && (
          <label data-field="confirmNoConflict" className={`flex gap-3 rounded-tile border p-3 text-sm ${errors.confirmNoConflict ? "border-danger-line bg-danger-bg/40" : "border-paper-line bg-paper-warm"}`}>
            <input type="checkbox" checked={noConflict} onChange={(e) => { setNoConflict(e.target.checked); setErrors((x) => { const { confirmNoConflict: _c, ...r } = x; return r; }); }} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
            <span>I have no personal, commercial, advisory or investment relationship with <strong>{applicantName}</strong> or this business, and my scores are my own independent judgement.</span>
          </label>
        )}
        {err("confirmNoConflict")}

        {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm font-semibold ${msg.tone === "err" ? "bg-danger-bg text-danger-fg" : "bg-lime/40 text-night"}`}>{msg.text}</p>}

        {review.status === "SUBMITTED" ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">This score sheet is submitted and locked. If something must change, ask the programme team to reopen it.</p>
            <div className="flex flex-wrap gap-3"><Link href={backHref} className="rounded-full border border-paper-line px-4 py-2 text-sm font-semibold text-primary">Back to list</Link>{nextHref && <Link href={nextHref} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">Next application →</Link>}</div>
          </div>
        ) : confirming ? (
          <div className="rounded-tile border-2 border-primary p-4" role="dialog" aria-label="Confirm submission">
            <p className="font-semibold text-primary">Submit a total of {total ?? "–"}/100?</p>
            <p className="mt-1 text-sm text-ink-soft">After submitting you cannot change your scores yourself.</p>
            <div className="mt-3 flex gap-3"><button type="button" disabled={busy} onClick={submit} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting…" : "Yes, submit"}</button><button type="button" onClick={() => setConfirming(false)} className="rounded-full border border-paper-line px-5 py-2 text-sm font-semibold text-primary">Not yet</button></div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">Submit scores</button>
            <button type="button" disabled={busy} onClick={save} className="rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary disabled:opacity-50">{busy ? "Saving…" : dirty ? "Save draft" : "Saved"}</button>
          </div>
        )}

        {review.status !== "SUBMITTED" && (
          <div className="border-t border-paper-line pt-4">
            {!coiOpen ? <button type="button" onClick={() => setCoiOpen(true)} className="text-sm font-semibold text-danger-fg underline">Declare a conflict of interest instead</button> : (
              <div className="space-y-2">
                <label htmlFor="coi" className="text-sm font-bold text-primary">What is the relationship?</label>
                <p className="text-xs text-ink-soft">For example “former colleague” or “I advise this business”. Only the programme team sees this. Any scores you saved here are cleared.</p>
                <textarea id="coi" value={coiNote} onChange={(e) => setCoiNote(e.target.value)} rows={2} maxLength={500} className="w-full rounded-md border border-paper-line px-3 py-2 text-sm" />
                {err("note")}
                <div className="flex gap-3"><button type="button" disabled={busy || coiNote.trim().length < 5} onClick={declare} className="rounded-full bg-danger-fg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Declare conflict</button><button type="button" onClick={() => setCoiOpen(false)} className="rounded-full border border-paper-line px-4 py-2 text-sm font-semibold text-primary">Cancel</button></div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
