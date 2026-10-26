"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Overview = { openToAll: boolean; invited: number; submitted: number; closeDate: string; waiting: Array<{ code: string; name: string; email: string; state: string }>;
  submissions: Array<{ code: string; contactName: string; businessName: string; state: string; lga: string; cropType: string; submittedAt: string }> };

/** Invite list, the link to share, progress, and the submissions. */
export function Level2Admin({ data, link, mayInvite, mayExport }: { data: Overview; link: string; mayInvite: boolean; mayExport: boolean }) {
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
          {mayExport && data.submitted > 0 && <a href="/api/admin/level-2" className="rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white">Download all answers (CSV)</a>}</div>
        {data.submissions.length === 0 ? <p className="mt-2 text-sm text-ink-muted">Nothing yet.</p> : (
          <div className="mt-3 overflow-x-auto rounded-md border border-paper-line">
            <table className="w-full min-w-[640px] text-sm"><thead className="bg-paper-warm text-left text-xs text-ink-muted"><tr><th className="px-3 py-2">Level 1 code</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Business</th><th className="px-3 py-2">State / LGA</th><th className="px-3 py-2">Crop</th><th className="px-3 py-2">Received</th><th className="px-3 py-2"><span className="sr-only">Details</span></th></tr></thead>
              <tbody className="divide-y divide-paper-line">{data.submissions.map((s) => <tr key={s.code} className="hover:bg-paper-warm/60"><td className="px-3 py-1.5 font-mono text-xs"><Link href={`/admin/level-2/${s.code}`} className="text-primary hover:underline">{s.code}</Link></td><td className="px-3 py-1.5">{s.contactName}</td><td className="px-3 py-1.5">{s.businessName}</td><td className="px-3 py-1.5">{s.state} · {s.lga}</td><td className="px-3 py-1.5">{s.cropType}</td><td className="px-3 py-1.5 whitespace-nowrap">{when(s.submittedAt)}</td><td className="px-3 py-1.5 text-right"><Link href={`/admin/level-2/${s.code}`} className="font-semibold text-primary hover:underline">View<span className="sr-only"> {s.businessName}</span></Link></td></tr>)}</tbody></table>
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
