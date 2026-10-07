"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

const EXAMPLES = ["How many applicants applied from Kaduna?", "Which states have the highest number of applicants?", "What percentage of applicants work in rice?", "Summarise the applications received so far."];
interface Answer { answer: string; provider: string; model: string; shared: { excerpts: number; applicantsConsidered: number } }

/** AIAnalyticsPanel: sends only the question and filters to the server. The server decides what data (aggregates) the AI sees. */
export function AIAnalyticsPanel() {
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false); const [res, setRes] = useState<Answer | null>(null); const [err, setErr] = useState("");
  async function ask(question: string) {
    if (busy || question.trim().length < 3) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await fetch("/api/admin/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) { window.location.href = "/admin/login"; return; }
      if (!r.ok) throw new Error(d.message || "Something went wrong. Please try again.");
      setRes(d);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-6">
      <div className="rounded-card bg-primary p-6 text-white sm:p-8">
        <h2 className="font-display text-2xl !text-white">Ask about the applications</h2>
        <p className="mt-2 text-sm text-white/85">The assistant sees summary figures only (counts and percentages). It cannot open the database and never receives names, contact details or individual records.</p>
        <label htmlFor="ai-q" className="mt-5 block text-sm font-semibold text-lime">Your question</label>
        <textarea id="ai-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} rows={3} className="mt-1 block w-full rounded-md border-0 bg-white p-3 text-base text-ink focus:ring-4 focus:ring-lime/60" placeholder="e.g. How many applicants applied from Kaduna?" />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => ask(q)} disabled={busy} className="!rounded-full !bg-sun !text-night hover:!bg-lime">{busy ? "Thinking…" : "Ask"}</Button>
          <span className="text-xs text-white/70">{q.length} / 500</span>
        </div>
      </div>
      <div><p className="text-sm font-semibold text-ink-soft">Try:</p><div className="mt-2 flex flex-wrap gap-2">{EXAMPLES.map((e) => <button key={e} type="button" onClick={() => { setQ(e); void ask(e); }} className="rounded-full border border-primary/30 bg-white px-4 py-2 text-left text-sm font-medium text-primary hover:bg-lime/40">{e}</button>)}</div></div>
      <div aria-live="polite">
        {err && <p role="alert" className="rounded-card border border-danger-line bg-danger-bg p-4 text-sm font-medium text-danger-fg">{err}</p>}
        {res && (
          <article className="rounded-card border border-paper-line bg-white p-6 shadow-card">
            <p className="whitespace-pre-wrap leading-relaxed text-ink">{res.answer}</p>
            <p className="mt-5 border-t border-dashed border-primary/25 pt-3 text-xs text-ink-muted">Answered by {res.provider} ({res.model}) using summary figures for {res.shared.applicantsConsidered} submitted applications{res.shared.excerpts ? ` and ${res.shared.excerpts} anonymised text excerpts` : ""}. Always check important figures in the dashboard.</p>
          </article>
        )}
      </div>
    </div>
  );
}
