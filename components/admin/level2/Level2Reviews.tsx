"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "WITHDRAWN";
type Row = { code: string; businessName: string; state: string; contactName: string; submittedAt: string;
  review: { reviewId: string; reviewerEmail: string; reviewerName: string; status: Status; total: number | null; percent: number | null; decision: "RECOMMEND" | "NOT_RECOMMEND" | null;
    topRank: number | null; legacyTotal: number | null; updatedAt: string } | null };
type Reviewer = { email: string; name: string; role: string; assigned: number; done: number };
type Data = { rows: Row[]; reviewers: Reviewer[]; maxTotal: number; legacyMax: number; stats: { submitted: number; assigned: number; reviewed: number; recommended: number } };
type Preview = { total: number; perReviewer: Array<{ email: string; name: string; adding: number; alreadyHas: number }> };

const FILTERS = [
  ["all", "All"], ["none", "No reviewer"], ["ASSIGNED", "Not started"], ["IN_PROGRESS", "Draft"], ["SUBMITTED", "Reviewed"], ["RECOMMEND", "Recommended"], ["TOP", "Top 3 picks"],
] as const;
type Filter = (typeof FILTERS)[number][0];
const STATUS_LABEL: Record<Status, string> = { ASSIGNED: "Not started", IN_PROGRESS: "Draft", SUBMITTED: "Reviewed", WITHDRAWN: "Withdrawn" };
const match = (r: Row, f: Filter) => f === "all" || (f === "none" ? !r.review : f === "RECOMMEND" ? r.review?.decision === "RECOMMEND" && r.review.status === "SUBMITTED"
  : f === "TOP" ? r.review?.topRank != null : r.review?.status === f);

async function post<T>(body: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/admin/level-2/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: d as T } : { ok: false, error: d.message ?? `The server answered ${res.status}.` };
  } catch { return { ok: false, error: "Could not reach the server." }; }
}

/** Share evenly (preview → confirm), then follow and adjust each applicant. */
export function Level2Reviews({ data, mayExport }: { data: Data; mayExport: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [byState, setByState] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const unassigned = data.rows.filter((r) => !r.review).length;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.rows.filter((r) => match(r, filter) && (!s || [r.code, r.businessName, r.state, r.review?.reviewerName ?? "", r.review?.reviewerEmail ?? ""].some((x) => x.toLowerCase().includes(s))));
  }, [data.rows, filter, q]);
  const done = (text: string) => { setMsg({ tone: "ok", text }); setSel([]); setPreview(null); router.refresh(); };
  const run = async <T,>(body: Record<string, unknown>, ok: (d: T) => string) => {
    setBusy(true); setMsg(null);
    const r = await post<T>(body); setBusy(false);
    if (r.ok) done(ok(r.data)); else setMsg({ tone: "err", text: r.error });
  };
  const skippedNote = (s: string[]) => (s.length ? ` Not changed: ${s.slice(0, 5).join(", ")}${s.length > 5 ? "…" : ""}.` : "");
  const allShown = shown.length > 0 && shown.every((r) => sel.includes(r.code));
  const card = "rounded-lg border border-paper-line bg-white";
  const btn = "inline-flex min-h-[40px] items-center rounded-full px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50";

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Applicants", data.stats.submitted], ["With a reviewer", data.stats.assigned], ["Reviewed", data.stats.reviewed], ["Recommended", data.stats.recommended]] as const).map(([l, v]) => (
          <div key={l} className={`${card} px-4 py-3`}><dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{l}</dt><dd className="mt-0.5 font-display text-2xl font-extrabold tabular-nums">{v}</dd></div>
        ))}
      </dl>

      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-md px-4 py-2.5 text-sm font-medium ${msg.tone === "err" ? "bg-danger-bg text-danger-fg" : "bg-leaf-50 text-forest-900"}`}>{msg.text}</p>}

      <section aria-labelledby="share-h" className={`${card} p-5`}>
        <h2 id="share-h" className="font-display text-lg font-extrabold">Share among reviewers</h2>
        {data.reviewers.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">There are no reviewer accounts yet. Add people with the Reviewer or Judge role in <Link href="/admin/staff" className="font-semibold text-primary underline">Staff</Link>.</p>
        ) : unassigned === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Every applicant has a reviewer. To change one, tick it in the list below and use <strong>Move to</strong>.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-soft"><strong className="tabular-nums">{unassigned}</strong> {unassigned === 1 ? "applicant has" : "applicants have"} no reviewer. Tick who should share them; each gets about the same number.</p>
            <fieldset className="mt-4">
              <legend className="sr-only">Reviewers</legend>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.reviewers.map((r) => (
                  <li key={r.email}>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm ${picked.includes(r.email) ? "border-primary bg-leaf-50" : "border-paper-line"}`}>
                      <input type="checkbox" className="h-4 w-4 accent-leaf-700" checked={picked.includes(r.email)} onChange={(e) => { setPreview(null); setPicked((p) => (e.target.checked ? [...p, r.email] : p.filter((x) => x !== r.email))); }} />
                      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name || r.email}</span><span className="block truncate text-xs text-ink-muted">{r.email}</span></span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-muted">{r.assigned} assigned · {r.done} done</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-leaf-700" checked={byState} onChange={(e) => { setByState(e.target.checked); setPreview(null); }} /> Mix states evenly between reviewers</label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" disabled={busy || !picked.length} onClick={async () => { setBusy(true); setMsg(null); const r = await post<Preview>({ action: "preview", reviewers: picked, byState }); setBusy(false); if (r.ok) setPreview(r.data); else setMsg({ tone: "err", text: r.error }); }}
                className={`${btn} border border-primary text-primary hover:bg-primary hover:text-white`}>Preview</button>
            </div>
            {preview && (
              <div className="mt-4 rounded-md border border-primary/40 bg-leaf-50 p-4" aria-live="polite">
                <ul className="space-y-1 text-sm">{preview.perReviewer.map((p) => <li key={p.email} className="flex justify-between gap-3"><span className="truncate">{p.name || p.email}</span><span className="tabular-nums">+{p.adding} <span className="text-ink-muted">(then {p.alreadyHas + p.adding})</span></span></li>)}</ul>
                <button type="button" disabled={busy || preview.total === 0} onClick={() => run<{ added: number }>({ action: "share", reviewers: picked, byState }, (d) => `${d.added} applicant${d.added === 1 ? "" : "s"} assigned.`)}
                  className={`${btn} mt-3 bg-primary text-white hover:bg-primary/90`}>{busy ? "Assigning…" : `Assign ${preview.total} applicant${preview.total === 1 ? "" : "s"}`}</button>
              </div>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="list-h" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-line px-5 py-3">
          <h2 id="list-h" className="font-display text-lg font-extrabold">Applicants</h2>
          {mayExport && data.rows.length > 0 && <a href="/api/admin/level-2/reviews" className="text-sm font-semibold text-primary hover:underline">Download results (CSV)</a>}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
          {FILTERS.map(([f, l]) => { const n = data.rows.filter((r) => match(r, f)).length; return (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setSel([]); }}
              className={`rounded-full border px-3 py-1 text-sm ${filter === f ? "border-primary bg-primary text-white" : "border-paper-line text-ink-soft hover:border-primary"}`}>{l} <span className="tabular-nums opacity-80">{n}</span></button>); })}
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, business, state or reviewer" aria-label="Search applicants"
            className="ml-auto min-w-[220px] flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:flex-none" />
        </div>

        {sel.length > 0 && (
          <div className="mx-5 mt-3 flex flex-wrap items-center gap-2 rounded-md bg-paper-warm px-3 py-2 text-sm" role="region" aria-label="Change selected">
            <span className="font-semibold tabular-nums">{sel.length} selected</span>
            <label className="sr-only" htmlFor="move-to">Move to reviewer</label>
            <select id="move-to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm">
              <option value="">Move to…</option>{data.reviewers.map((r) => <option key={r.email} value={r.email}>{r.name || r.email}</option>)}
            </select>
            <button type="button" disabled={busy || !moveTo} onClick={() => run<{ moved: number; skipped: string[] }>({ action: "move", codes: sel, to: moveTo }, (d) => `${d.moved} moved.${skippedNote(d.skipped)}`)} className={`${btn} bg-primary text-white`}>Move</button>
            <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove the reviewer from ${sel.length} applicant(s)? Reviews already submitted are kept.`)) run<{ removed: number; skipped: string[] }>({ action: "unassign", codes: sel }, (d) => `Reviewer removed from ${d.removed}.${skippedNote(d.skipped)}`); }} className={`${btn} text-danger-fg hover:underline`}>Remove reviewer</button>
            <button type="button" onClick={() => setSel([])} className="ml-auto text-sm text-ink-muted hover:underline">Clear</button>
          </div>
        )}

        {shown.length === 0 ? <p className="px-5 py-8 text-center text-sm text-ink-muted">{data.rows.length ? "Nothing matches." : "No Level 2 applications yet."}</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-y border-paper-line bg-paper-warm text-left text-xs text-ink-muted">
                <tr>
                  <th className="w-10 px-5 py-2"><input type="checkbox" aria-label="Select all shown" className="h-4 w-4 accent-leaf-700" checked={allShown} onChange={(e) => setSel(e.target.checked ? shown.map((r) => r.code) : [])} /></th>
                  <th className="px-3 py-2">Applicant</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Reviewer</th><th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Score</th><th className="px-3 py-2">Decision</th><th className="px-5 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {shown.map((r) => (
                  <tr key={r.code} className={sel.includes(r.code) ? "bg-leaf-50/60" : undefined}>
                    <td className="px-5 py-2"><input type="checkbox" aria-label={`Select ${r.businessName}`} className="h-4 w-4 accent-leaf-700" checked={sel.includes(r.code)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, r.code] : s.filter((x) => x !== r.code)))} /></td>
                    <td className="px-3 py-2"><Link href={`/admin/level-2/${r.code}`} className="font-medium text-forest-900 hover:text-primary hover:underline">{r.businessName || r.code}</Link><span className="block font-mono text-xs text-ink-muted">{r.code}</span></td>
                    <td className="px-3 py-2">{r.state}</td>
                    <td className="px-3 py-2">{r.review ? (r.review.reviewerName || r.review.reviewerEmail) : <span className="text-ink-muted">—</span>}</td>
                    <td className="px-3 py-2">{r.review ? <span className={r.review.status === "SUBMITTED" ? "font-semibold text-primary" : "text-ink-soft"}>{STATUS_LABEL[r.review.status]}</span> : <span className="text-ink-muted">No reviewer</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.review?.status === "SUBMITTED" && r.review.percent != null ? <span className="font-semibold">{r.review.percent}%</span>
                        : r.review?.legacyTotal != null ? <span className="text-ink-muted" title="Marked on the earlier form. Reopen so the reviewer can mark it on the current sheet.">{r.review.legacyTotal}/{data.legacyMax} · earlier form</span> : ""}
                      {r.review?.topRank != null && <span className="ml-2 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-semibold text-primary">Top {r.review.topRank}</span>}
                    </td>
                    <td className="px-3 py-2">{r.review?.status === "SUBMITTED" ? (r.review.decision === "RECOMMEND" ? "Recommend" : "Do not recommend") : ""}</td>
                    <td className="px-5 py-2 text-right">{r.review?.status === "SUBMITTED" && (
                      <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Reopen the review of ${r.businessName}? The reviewer can then change it and must submit again.`)) run({ action: "reopen", code: r.code }, () => "Reopened. The reviewer can change it now."); }} className="text-sm font-semibold text-primary hover:underline">Reopen</button>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
