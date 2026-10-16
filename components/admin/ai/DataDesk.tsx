"use client";
import { useRef, useState } from "react";

type Output = { id: string; title: string; tab: string | null; url: string | null; rows: number };
type Turn = { q: string; answer?: string; steps?: string[]; outputs?: Output[]; error?: string };

const EXAMPLES = [
  "Create a sheet of the 1300 best eligible applicants, 60% from focal states, with name, phone, email, state and pre-score",
  "Which value chains do the top 500 come from, and how many women are among them?",
  "Read the 20 highest pre-scores from Kaduna and write a one-line note on each; put it in a sheet",
  "Make a sheet of applicants flagged for checking, with the flags and their contact details",
];

/** Administrators' conversation with the AI data desk. Answers, steps taken, and any NEW sheets it created. */
export function DataDesk({ ready, fullAccess, tabsOn }: { ready: boolean; fullAccess: boolean; tabsOn: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    const history = turns.flatMap((t) => (t.answer ? [{ role: "user", content: t.q }, { role: "assistant", content: t.answer }] : []));
    setTurns((t) => [...t, { q: question }]); setQ(""); setBusy(true);
    try {
      const res = await fetch("/api/admin/ai-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, history }) });
      const d = await res.json().catch(() => ({}));
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? (res.ok ? { ...x, ...d } : { ...x, error: `${d.message ?? "That did not work."}${d.code ? ` (code ${d.code}${d.ref ? `, ref ${d.ref}` : ""})` : ""}` }) : x)));
    } catch { setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: "Could not reach the server." } : x))); }
    finally { setBusy(false); setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50); }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[["AI", ready ? "Switched on" : "Not switched on", ready], ["Personal details to the AI", fullAccess ? "Shared" : "Not shared (sheets can still include them)", fullAccess], ["New tabs in the sheet", tabsOn ? "Available" : "CSV download only", tabsOn]].map(([l, v, on]) => (
          <div key={l as string} className="rounded-lg border border-paper-line bg-white px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{l}</p><p className={`mt-0.5 text-sm font-semibold ${on ? "text-primary" : "text-ink-soft"}`}>{v}</p></div>
        ))}
      </div>
      <p className="rounded-md border border-paper-line bg-paper-warm/40 px-4 py-3 text-sm text-ink-soft">
        The AI can read every application and create <strong>new</strong> tabs named “AI · …” with the results. It cannot change, move or delete anything that already exists.
        Check its lists before you use them: the pre-score is an automatic estimate, and the AI can misread a request. Every request and every new tab is recorded in the audit log.
      </p>

      {turns.length === 0 && ready && (
        <div className="flex flex-wrap gap-2">{EXAMPLES.map((x) => <button key={x} type="button" onClick={() => ask(x)} className="rounded-full border border-paper-line bg-white px-3 py-1.5 text-left text-xs text-ink-soft hover:border-primary hover:text-primary">{x}</button>)}</div>
      )}

      <ol className="space-y-4">
        {turns.map((t, i) => (
          <li key={i} className="space-y-2">
            <p className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-4 py-2.5 text-sm text-white sm:max-w-[70%]">{t.q}</p>
            <div className="max-w-[95%] rounded-lg border border-paper-line bg-white px-4 py-3 text-sm sm:max-w-[85%]" aria-live="polite">
              {!t.answer && !t.error && <p className="text-ink-muted">Working through the data… (large requests can take a minute)</p>}
              {t.error && <p role="alert" className="font-semibold text-danger-fg">{t.error}</p>}
              {t.answer && <p className="whitespace-pre-wrap leading-relaxed">{t.answer}</p>}
              {t.outputs && t.outputs.length > 0 && (
                <ul className="mt-3 space-y-2">{t.outputs.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                    <span className="min-w-0 flex-1 font-semibold">{o.tab ?? o.title} <span className="font-normal text-ink-muted">· {o.rows.toLocaleString("en-GB")} rows</span></span>
                    {o.url && <a href={o.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-white">Open in Google Sheets</a>}
                    <a href={`/api/admin/ai-data/download?id=${o.id}`} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Download CSV</a>
                  </li>))}</ul>
              )}
              {t.steps && t.steps.length > 0 && <details className="mt-2 text-xs text-ink-muted"><summary className="cursor-pointer">What the AI looked at ({t.steps.length})</summary><ul className="mt-1 list-disc pl-5">{t.steps.map((s, j) => <li key={j}>{s}</li>)}</ul></details>}
            </div>
          </li>
        ))}
      </ol>
      <div ref={end} />

      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="sticky bottom-3 flex flex-col gap-2 rounded-lg border border-paper-line bg-white/95 p-3 shadow-lg backdrop-blur sm:mr-32 sm:flex-row">
        <label htmlFor="desk-q" className="sr-only">Your request</label>
        <textarea id="desk-q" rows={2} value={q} disabled={!ready} onChange={(e) => setQ(e.target.value)} maxLength={2000}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
          placeholder={ready ? "Ask about the applications, or ask for a new sheet…" : "Switch the AI on first (see above)."}
          className="min-h-[3rem] flex-1 resize-y rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-paper-warm" />
        <button type="submit" disabled={busy || !ready || !q.trim()} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:self-end">{busy ? "Working…" : "Send"}</button>
      </form>
    </div>
  );
}
