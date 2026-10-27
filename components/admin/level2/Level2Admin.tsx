"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Overview = { openToAll: boolean; invited: number; submitted: number; closeDate: string; waiting: Array<{ code: string; name: string; email: string; state: string }>;
  submissions: Array<{ code: string; contactName: string; businessName: string; state: string; lga: string; cropType: string; submittedAt: string }> };

type Result = { percent: number | null; status: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "WITHDRAWN"; decision: "RECOMMEND" | "NOT_RECOMMEND" | null; reviewerName: string; topRank: number | null; legacy: boolean };
type Results = { results: Record<string, Result>; required: number;
  picks: Array<{ email: string; name: string; assigned: number; done: number; top: Array<{ rank: number; code: string; businessName: string; state: string; percent: number | null; decision: Result["decision"]; reason: string; reopened: boolean }> }> };

const scoreText = (r: Result | undefined) => !r ? "No reviewer" : r.legacy ? "Earlier form" : r.status === "SUBMITTED" && r.percent != null ? `${r.percent}%` : r.status === "IN_PROGRESS" ? "Draft" : "Not started";

/** Reviewers' top 3 and every applicant's score, the link to share, invites, and the submissions. */
export function Level2Admin({ data, results, link, mayInvite, mayExport }: { data: Overview; results: Results | null; link: string; mayInvite: boolean; mayExport: boolean }) {
  const [sort, setSort] = useState<"newest" | "score">("newest");
  const subs = useMemo(() => sort === "newest" ? data.submissions
    : [...data.submissions].sort((a, b) => (results?.results[b.code]?.percent ?? -1) - (results?.results[a.code]?.percent ?? -1)), [data.submissions, results, sort]);
  const router = useRouter();
  const [codes, setCodes] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState("");

  async function invite() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/level-2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codes, note }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ tone: "err", text: `${d.message ?? "That did not work."}${d.ref ? ` (ref ${d.ref})` : ""}` }); return; }
      setMsg({ tone: "ok", text: `${d.added} invited.${d.already ? ` ${d.already} were already invited.` : ""}${d.notFound.length ? ` Not found (${d.notFound.length}): ${d.notFound.slice(0, 8).join(", ")}${d.notFound.length > 8 ? "…" : ""}` : ""}` });
      setCodes(""); router.refresh();
    } catch { setMsg({ tone: "err", text: "Could not reach the server." }); } finally { setBusy(false); }
  }
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 2000); } catch { /* clipboard blocked */ } };
  const card = "rounded-lg border border-paper-line bg-white p-5";
  const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-3">
        {[["Invited", data.invited], ["Submitted", data.submitted], ["Waiting", data.waiting.length]].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-paper-line bg-white px-4 py-3"><dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{l}</dt><dd className="mt-0.5 font-display text-2xl font-extrabold tabular-nums">{v}</dd></div>))}
      </dl>

      {results && results.picks.length > 0 && (
        <section className="rounded-lg border border-paper-line bg-white" aria-labelledby="top-h">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-paper-line px-5 py-4">
            <div><h2 id="top-h" className="font-display text-xl font-extrabold">Reviewers&rsquo; top {results.required}</h2>
              <p className="mt-0.5 text-sm text-ink-soft">Each reviewer&rsquo;s best applicants, in their order, with their reason. All scores are in the table below.</p></div>
            <Link href="/admin/level-2/reviews" className="text-sm font-semibold text-primary hover:underline">All reviews →</Link>
          </div>
          <div className="divide-y divide-paper-line">
            {results.picks.map((p) => (
              <div key={p.email} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-forest-900">{p.name || p.email}</h3>
                  <span className="text-xs tabular-nums text-ink-muted">{p.done} of {p.assigned} reviewed</span>
                </div>
                {p.top.length === 0 ? <p className="mt-1.5 text-sm text-ink-muted">Not chosen yet.</p> : (
                  <ol className="mt-2 space-y-2.5">
                    {p.top.map((t) => (
                      <li key={t.code} className="grid grid-cols-[1.5rem_1fr_auto] gap-x-3 text-sm">
                        <span className="font-semibold tabular-nums text-ink-muted">{t.rank}.</span>
                        <span className="min-w-0"><Link href={`/admin/level-2/${t.code}`} className="font-medium text-forest-900 hover:text-primary hover:underline">{t.businessName || t.code}</Link>
                          <span className="text-ink-muted"> · {t.state}{t.decision === "NOT_RECOMMEND" ? " · not recommended" : ""}{t.reopened ? " · review reopened" : ""}</span></span>
                        <span className="text-right font-semibold tabular-nums">{t.percent != null ? `${t.percent}%` : "—"}</span>
                        {t.reason && <p className="col-start-2 col-end-4 mt-0.5 text-ink-soft">{t.reason}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={card} aria-labelledby="link-h">
        <h2 id="link-h" className="font-display text-xl font-extrabold">The form link</h2>
        <p className="mt-1 text-sm text-ink-soft">Not shown anywhere on the site. Send it to the invited applicants (for example from Messages). {data.openToAll ? "Open to EVERY Level 1 applicant (LEVEL2_OPEN_TO_ALL=true): code + matching Level 1 email required; the invite list is not used." : "Only invited Level 1 codes, with the matching Level 1 email, can open the form."} Each code can submit once.{data.closeDate ? ` Closes ${when(data.closeDate)}.` : " No closing date is set (LEVEL2_CLOSE_DATE)."}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-md border border-paper-line bg-paper-warm/40 px-3 py-2 text-sm">{link}</code>
          <button type="button" onClick={() => copy(link, "link")} className="rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white">{copied === "link" ? "Copied" : "Copy link"}</button></div>
      </section>

      {mayInvite && (
        <section className={card} aria-labelledby="inv-h">
          <h2 id="inv-h" className="font-display text-xl font-extrabold">Invite</h2>
          <p className="mt-1 text-sm text-ink-soft">Paste Level 1 codes: one per line, or a whole column copied from a CSV (for example the 180 list from Screening). Codes already invited are skipped. Invites cannot be removed here; to withdraw one, tell the person and ignore their submission.</p>
          <textarea rows={5} value={codes} onChange={(e) => setCodes(e.target.value)} className="mt-3 w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm" placeholder={"AGRA-2026-K7QX4M\nAGRA-2026-…"} aria-label="Level 1 codes to invite" />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional), e.g. Focal 180" className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm" aria-label="Note" />
            <button type="button" disabled={busy || !codes.trim()} onClick={invite} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Inviting…" : "Invite"}</button>
          </div>
          {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`mt-3 rounded-md px-3 py-2 text-sm font-semibold ${msg.tone === "err" ? "bg-danger-bg text-danger-fg" : "bg-lime/40 text-night"}`}>{msg.text}</p>}
        </section>
      )}

      <section className={card} aria-labelledby="sub-h">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="sub-h" className="font-display text-xl font-extrabold">Submitted ({data.submitted})</h2>
          <div className="flex flex-wrap items-center gap-2">
            {results && data.submitted > 1 && (
              <div role="group" aria-label="Sort" className="flex rounded-full border border-paper-line p-0.5 text-sm">
                {([["newest", "Newest"], ["score", "Highest score"]] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={`rounded-full px-3 py-1 ${sort === k ? "bg-primary text-white" : "text-ink-soft hover:text-forest-900"}`}>{l}</button>))}
              </div>)}
            {mayExport && data.submitted > 0 && <a href="/api/admin/level-2" className="rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white">Download all answers (CSV)</a>}
          </div></div>
        {data.submissions.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Nothing yet.</p> : (
          <div className="mt-3 overflow-x-auto rounded-md border border-paper-line">
            <table className="w-full min-w-[720px] text-sm"><thead className="bg-paper-warm text-left text-xs text-ink-muted"><tr><th className="px-3 py-2">Level 1 code</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Business</th><th className="px-3 py-2">State / LGA</th><th className="px-3 py-2">Crop</th><th className="px-3 py-2">Received</th>{results && <th className="px-3 py-2 text-right">Score</th>}<th className="px-3 py-2"><span className="sr-only">Details</span></th></tr></thead>
              <tbody className="divide-y divide-paper-line">{subs.map((s) => <tr key={s.code} className="hover:bg-paper-warm/60"><td className="px-3 py-1.5 font-mono text-xs"><Link href={`/admin/level-2/${s.code}`} className="text-primary hover:underline">{s.code}</Link></td><td className="px-3 py-1.5">{s.contactName}</td><td className="px-3 py-1.5">{s.businessName}</td><td className="px-3 py-1.5">{s.state} · {s.lga}</td><td className="px-3 py-1.5">{s.cropType}</td><td className="px-3 py-1.5 whitespace-nowrap">{when(s.submittedAt)}</td>{results && (() => { const r = results.results[s.code]; return <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                {r?.topRank != null && <span className="mr-2 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-semibold text-primary" title={`Number ${r.topRank} in ${r.reviewerName}'s top ${results.required}`}>Top {r.topRank}</span>}
                <span className={r?.status === "SUBMITTED" && !r.legacy ? "font-semibold" : "text-ink-muted"}>{scoreText(r)}</span></td>; })()}<td className="px-3 py-1.5 text-right"><Link href={`/admin/level-2/${s.code}`} className="font-semibold text-primary hover:underline">View<span className="sr-only"> {s.businessName}</span></Link></td></tr>)}</tbody></table>
          </div>)}
        <p className="mt-2 text-xs text-ink-muted">Every answer is also in the “Level 2 Applications” tab of the Google Sheet.</p>
      </section>

      {data.waiting.length > 0 && (
        <section className={card} aria-labelledby="wait-h">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="wait-h" className="font-display text-xl font-extrabold">Invited, not submitted yet ({data.waiting.length})</h2>
            <button type="button" onClick={() => copy(data.waiting.map((w) => w.code).join("\n"), "codes")} className="rounded-full border border-paper-line px-4 py-2 text-sm font-semibold">{copied === "codes" ? "Copied" : "Copy their codes (for a reminder in Messages)"}</button></div>
          <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">{data.waiting.slice(0, 400).map((w) => <li key={w.code} className="flex gap-3"><span className="font-mono text-xs text-ink-muted">{w.code}</span><span>{w.name}</span><span className="text-ink-muted">{w.state}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
