"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postScreening } from "./post";

type Spec = { size: number; focalShare: number | null; otherShare: number | null; minWomenShare: number | null; minPwdShare: number | null; minRuralShare: number | null; minimumsWithinFirst: number | null; states: string[]; valueChains: string[] };
type Report = { counts: { total: number; focal: number; other: number; women: number; pwd: number; rural: number }; scope: { size: number; women: number; pwd: number; rural: number } | null; lowestScore: number | null; notes: string[]; eligible: number };
type Reply =
  | { kind: "list"; spec: Spec; description: string; source: "ai" | "rules"; understood: string[]; unclear: string[]; report: Report }
  | { kind: "answer"; text: string; lines: Array<[string, string]> }
  | { kind: "action"; text: string; preview: Record<string, unknown>; confirm: Record<string, unknown> }
  | { kind: "unclear"; text: string };

const pct = (v: number | null) => (v == null ? "" : String(Math.round(v * 100)));
const fromPct = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.min(100, Number(s) || 0)) / 100);
const share = (n: number, d: number) => (d ? ` (${Math.round((n / d) * 100)}%)` : "");
const toB64url = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Plain-language requests. Lists are previewed (settings can be corrected) before download; actions need Confirm. */
export function ScreeningAssistant({ examples, mayExport }: { examples: string[]; mayExport: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [edit, setEdit] = useState<Spec | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(body: Record<string, unknown>) {
    setBusy(true); setErr(null); setDone(null);
    try {
      const res = await fetch("/api/admin/screening/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(`${d.message ?? "That did not work."}${d.code ? ` (code ${d.code}${d.ref ? `, ref ${d.ref}` : ""})` : ""}`); return; }
      setReply(d); setEdit(d.kind === "list" ? d.spec : null);
    } catch { setErr("Could not reach the server."); } finally { setBusy(false); }
  }
  async function confirm(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const r = await postScreening(body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setReply(null); setDone("Done. The page below is updated."); router.refresh();
  }
  const num = "w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm tabular-nums";
  const field = (label: string, value: string, onChange: (v: string) => void, suffix = "%") => (
    <label className="text-xs font-semibold text-ink-muted">{label}
      <span className="mt-1 flex items-center gap-1"><input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder="–" className={num} />{suffix && <span className="text-ink-muted">{suffix}</span>}</span></label>
  );

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); send({ text }); }} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="ask" className="sr-only">Quick request</label>
        <textarea id="ask" rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={600}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) send({ text }); } }}
          placeholder="e.g. Send the CSV of the best 1300, 60% from focal states, 40% from other states, at least 20% women"
          className="min-h-[3rem] flex-1 resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button type="submit" disabled={busy || !text.trim()} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:self-start">{busy ? "Working…" : "Send"}</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {examples.map((x) => <button key={x} type="button" onClick={() => { setText(x); send({ text: x }); }} className="rounded-full border border-paper-line px-3 py-1 text-left text-xs text-ink-soft hover:border-primary hover:text-primary">{x}</button>)}
      </div>
      {err && <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm font-semibold text-danger-fg">{err}</p>}
      {done && <p role="status" className="rounded-md bg-lime/40 px-3 py-2 text-sm font-semibold text-night">{done}</p>}

      {reply?.kind === "unclear" && <p className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-fg">{reply.text}</p>}

      {reply?.kind === "answer" && (
        <div className="rounded-lg border border-paper-line p-4 text-sm" aria-live="polite">
          <p className="font-semibold">{reply.text}</p>
          {reply.lines.length > 0 && <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">{reply.lines.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-paper-line py-1"><dt className="text-ink-soft">{k}</dt><dd className="tabular-nums font-semibold">{v}</dd></div>)}</dl>}
        </div>
      )}

      {reply?.kind === "action" && (
        <div className="rounded-lg border-2 border-primary p-4 text-sm" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Proposed change: nothing happens until you confirm</p>
          <p className="mt-1 font-semibold">{reply.text}</p>
          {Array.isArray(reply.preview.byPerson) && <ul className="mt-2 grid gap-1 sm:grid-cols-2">{(reply.preview.byPerson as Array<{ name: string; count: number }>).map((p) => <li key={p.name} className="flex justify-between border-b border-paper-line py-1"><span>{p.name}</span><span className="tabular-nums">+{p.count}</span></li>)}</ul>}
          {Array.isArray(reply.preview.skipped) && (reply.preview.skipped as string[]).length > 0 && <p className="mt-2 text-warn-fg">{(reply.preview.skipped as string[]).length} cannot move (own application, conflict, or already with that person).</p>}
          <div className="mt-3 flex gap-3">
            <button type="button" disabled={busy} onClick={() => confirm(reply.confirm)} className="rounded-full bg-primary px-5 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Working…" : "Confirm"}</button>
            <button type="button" onClick={() => setReply(null)} className="rounded-full border border-paper-line px-5 py-2 font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {reply?.kind === "list" && edit && (
        <div className="space-y-3 rounded-lg border-2 border-primary p-4 text-sm" aria-live="polite">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">I understood{reply.source === "ai" ? " (read by the AI)" : ""}. Check it, correct anything below, then download.</p>
            <p className="mt-1 font-semibold">{reply.description}</p>
            {[...reply.understood, ...reply.unclear].map((n) => <p key={n} className="text-ink-soft">{n}</p>)}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {field("List size", String(edit.size), (v) => setEdit({ ...edit, size: Math.max(1, Math.min(20000, Number(v) || 1)) }), "")}
            {field("Focal states", pct(edit.focalShare), (v) => setEdit({ ...edit, focalShare: fromPct(v) }))}
            {field("Other states", pct(edit.otherShare), (v) => setEdit({ ...edit, otherShare: fromPct(v) }))}
            {field("Women, at least", pct(edit.minWomenShare), (v) => setEdit({ ...edit, minWomenShare: fromPct(v) }))}
            {field("PWD, at least", pct(edit.minPwdShare), (v) => setEdit({ ...edit, minPwdShare: fromPct(v) }))}
            {field("Rural, at least", pct(edit.minRuralShare), (v) => setEdit({ ...edit, minRuralShare: fromPct(v) }))}
            {field("Minimums in first", edit.minimumsWithinFirst == null ? "" : String(edit.minimumsWithinFirst), (v) => setEdit({ ...edit, minimumsWithinFirst: v.trim() ? Math.max(1, Number(v) || 1) : null }), "")}
          </div>
          <button type="button" disabled={busy} onClick={() => send({ spec: edit })} className="rounded-full border border-primary px-4 py-1.5 font-semibold text-primary disabled:opacity-50">{busy ? "Working…" : "Update preview"}</button>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[["In the list", reply.report.counts.total.toLocaleString("en-GB")], ["Focal states", `${reply.report.counts.focal}${share(reply.report.counts.focal, reply.report.counts.total)}`], ["Other states", `${reply.report.counts.other}${share(reply.report.counts.other, reply.report.counts.total)}`],
              ["Women", `${reply.report.counts.women}${share(reply.report.counts.women, reply.report.counts.total)}`], ["PWD", `${reply.report.counts.pwd}${share(reply.report.counts.pwd, reply.report.counts.total)}`], ["Lowest pre-score", String(reply.report.lowestScore ?? "–")]]
              .map(([k, v]) => <div key={k} className="rounded-md border border-paper-line px-3 py-2"><dt className="text-xs text-ink-muted">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>)}
          </dl>
          {reply.report.scope && <p>In the first {reply.report.scope.size}: {reply.report.scope.women} women{share(reply.report.scope.women, reply.report.scope.size)}, {reply.report.scope.pwd} PWD{share(reply.report.scope.pwd, reply.report.scope.size)}, {reply.report.scope.rural} rural.</p>}
          {reply.report.notes.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-ink-soft">{reply.report.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          {JSON.stringify(edit) !== JSON.stringify(reply.spec) && <p className="text-warn-fg">You changed the settings: press Update preview before downloading.</p>}
          {mayExport ? (
            <a aria-disabled={JSON.stringify(edit) !== JSON.stringify(reply.spec)} href={`/api/admin/screening/export?list=custom&spec=${toB64url(reply.spec)}`}
              className={`inline-flex rounded-full bg-primary px-5 py-2 font-semibold text-white ${JSON.stringify(edit) !== JSON.stringify(reply.spec) ? "pointer-events-none opacity-50" : ""}`}>Download CSV ({reply.report.counts.total.toLocaleString("en-GB")})</a>
          ) : <p className="text-warn-fg">Your role cannot download lists with personal data.</p>}
        </div>
      )}
    </div>
  );
}
