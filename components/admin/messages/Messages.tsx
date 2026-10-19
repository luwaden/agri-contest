"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Campaign = { campaignId: string; createdAt: string; createdBy: string; subject: string; audience: string; total: number; sent: number; failed: number; remaining: number; cancelled: boolean; lastErrors: string[] };
type Overview = { campaigns: Campaign[]; sentToday: number; dailyLimit: number; sender: "gmail" | "resend" | "off"; senderProblem: string | null; from: string };
type Preview = { count: number; label: string; notFound: string[]; sample: Array<{ applicationId: string; name: string; email: string }>; email: { subject: string; html: string; text: string; to: string } | null };

const AUDIENCES = [
  ["passed", "Passed by reviewers"], ["batch", "Everyone with a screening reviewer"], ["judges", "Everyone with judges"],
  ["finalists", "Top N by judges' scores"], ["top", "Top N eligible by pre-score"], ["status", "Everyone with a status"], ["pasted", "A list I paste (references or emails)"],
] as const;
const STATUSES = ["SHORTLISTED", "FINALIST", "WINNER", "NOT_SELECTED", "UNDER_REVIEW", "SUBMITTED"];
const FILL = ["first_name", "full_name", "application_id", "business_name", "state"];
const STOP: Record<string, string> = {
  DAILY_LIMIT: "Today's sending limit is reached. Press Continue tomorrow; nobody will get it twice.",
  DAILY_LIMIT_OR_RATE_LIMIT: "The email service says the daily limit is reached. Continue tomorrow.",
  GMAIL_LOGIN_REJECTED: "Gmail refused the login. Check GMAIL_USER and GMAIL_APP_PASSWORD on the server.",
  DOMAIN_NOT_VERIFIED: "The sending domain is not verified with Resend.",
  CANCELLED: "This message was cancelled.",
};

async function api<T>(body?: Record<string, unknown>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/admin/messages", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: d as T } : { ok: false, error: `${d.message ?? `The server answered ${res.status}.`}${d.code ? ` (code ${d.code}${d.ref ? `, ref ${d.ref}` : ""})` : ""}` };
  } catch { return { ok: false, error: "Could not reach the server." }; }
}

export function Messages({ initial }: { initial: Overview }) {
  const [ov, setOv] = useState(initial);
  const [kind, setKind] = useState<string>("passed");
  const [n, setN] = useState(30); const [status, setStatus] = useState("SHORTLISTED"); const [pasted, setPasted] = useState("");
  const [subject, setSubject] = useState(""); const [heading, setHeading] = useState(""); const [body, setBody] = useState("Dear {first_name},\n\n");
  const [pv, setPv] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [stopNote, setStopNote] = useState<Record<string, string>>({});
  const bodyRef = useRef<HTMLTextAreaElement>(null); const stopFlag = useRef(false);

  const audience = () => (kind === "finalists" || kind === "top" ? { kind, n } : kind === "status" ? { kind, status } : kind === "pasted" ? { kind, text: pasted } : { kind });
  const message = () => ({ subject, heading, body, audience: audience() });
  const changed = () => { setPv(null); setConfirming(false); };
  const refresh = useCallback(async () => { const r = await api<Overview>(); if (r.ok) setOv(r.data); }, []);

  async function doPreview() { setBusy(true); setMsg(null); const r = await api<Preview>({ action: "preview", ...message() }); setBusy(false); if (r.ok) setPv(r.data); else { setPv(null); setMsg({ tone: "err", text: r.error }); } }
  async function doTest() { setBusy(true); setMsg(null); const r = await api<{ sentTo: string }>({ action: "test", ...message() }); setBusy(false); setMsg(r.ok ? { tone: "ok", text: `Test sent to ${r.data.sentTo}. Check that inbox (and its Spam folder).` } : { tone: "err", text: r.error }); }
  async function doCreate() {
    setBusy(true); setMsg(null);
    const r = await api<{ campaign: Campaign }>({ action: "create", ...message() }); setBusy(false);
    if (!r.ok) { setMsg({ tone: "err", text: r.error }); return; }
    setPv(null); setConfirming(false); setSubject(""); setHeading(""); setBody("Dear {first_name},\n\n");
    await refresh(); run(r.data.campaign.campaignId);
  }

  async function run(id: string) {
    if (running) return;
    setRunning(id); stopFlag.current = false; setStopNote((s) => ({ ...s, [id]: "" }));
    try {
      for (;;) {
        if (stopFlag.current) { setStopNote((s) => ({ ...s, [id]: "Paused. Press Continue to carry on." })); break; }
        const r = await api<{ done: boolean; stopped: string | null; progress: Campaign }>({ action: "send", campaignId: id });
        if (!r.ok) { setStopNote((s) => ({ ...s, [id]: r.error })); break; }
        setOv((o) => ({ ...o, campaigns: o.campaigns.map((c) => (c.campaignId === id ? r.data.progress : c)) }));
        if (r.data.done) { setStopNote((s) => ({ ...s, [id]: r.data.stopped ? STOP[r.data.stopped] ?? r.data.stopped : "Finished." })); break; }
        if (r.data.stopped) { setStopNote((s) => ({ ...s, [id]: STOP[r.data.stopped!] ?? `Stopped: ${r.data.stopped}` })); break; }
      }
    } finally { setRunning(null); refresh(); }
  }
  async function cancel(id: string) { stopFlag.current = true; const r = await api({ action: "cancel", campaignId: id }); if (!r.ok) setMsg({ tone: "err", text: r.error }); refresh(); }

  useEffect(() => {   // warn before closing the page while sending
    if (!running) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [running]);

  const insert = (k: string) => { const el = bodyRef.current; const at = el?.selectionStart ?? body.length; setBody(body.slice(0, at) + `{${k}}` + body.slice(el?.selectionEnd ?? at)); changed(); setTimeout(() => el?.focus(), 0); };
  const input = "mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
  const off = ov.sender === "off";

  return (
    <div className="space-y-8">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-paper-line bg-white px-4 py-3"><dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sent from</dt><dd className="mt-0.5 truncate text-sm font-semibold">{off ? "Email is not set up" : ov.from}</dd></div>
        <div className="rounded-lg border border-paper-line bg-white px-4 py-3"><dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sent today</dt><dd className="mt-0.5 text-sm font-semibold tabular-nums">{ov.sentToday} of {ov.dailyLimit}</dd></div>
        <div className="rounded-lg border border-paper-line bg-white px-4 py-3"><dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Service</dt><dd className="mt-0.5 text-sm font-semibold">{ov.sender === "gmail" ? "Gmail (about 500 a day)" : ov.sender === "resend" ? "Resend" : "Off"}</dd></div>
      </dl>
      {(off || ov.senderProblem) && <p className="rounded-md bg-warn-bg px-3 py-2 text-sm text-warn-fg">{ov.senderProblem ?? "Set GMAIL_USER and GMAIL_APP_PASSWORD in the server settings, then restart."}</p>}

      <section aria-labelledby="new-h" className="space-y-4 rounded-lg border border-paper-line bg-white p-5">
        <h2 id="new-h" className="font-display text-xl font-extrabold">New message</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Send to
            <select value={kind} onChange={(e) => { setKind(e.target.value); changed(); }} className={input}>{AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {(kind === "finalists" || kind === "top") && <label className="text-sm font-semibold">How many
            <input type="number" min={1} max={2000} value={n} onChange={(e) => { setN(Math.max(1, Number(e.target.value) || 1)); changed(); }} className={`${input} tabular-nums`} /></label>}
          {kind === "status" && <label className="text-sm font-semibold">Status
            <select value={status} onChange={(e) => { setStatus(e.target.value); changed(); }} className={input}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>}
        </div>
        {kind === "pasted" && <label className="block text-sm font-semibold">References or email addresses <span className="font-normal text-ink-muted">(one per line, or separated by commas; you can paste a column from a CSV)</span>
          <textarea rows={4} value={pasted} onChange={(e) => { setPasted(e.target.value); changed(); }} className={`${input} font-mono`} placeholder={"AGRA-2026-K7QX4M\nname@example.com"} /></label>}
        <label className="block text-sm font-semibold">Subject
          <input value={subject} maxLength={150} onChange={(e) => { setSubject(e.target.value); changed(); }} className={input} placeholder="e.g. You have been shortlisted, {first_name}" /></label>
        <label className="block text-sm font-semibold">Heading in the email <span className="font-normal text-ink-muted">(optional; the subject is used if empty)</span>
          <input value={heading} maxLength={120} onChange={(e) => { setHeading(e.target.value); changed(); }} className={input} /></label>
        <div>
          <label htmlFor="msg-body" className="text-sm font-semibold">Message</label>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs"><span className="text-ink-muted">Insert:</span>{FILL.map((k) => <button key={k} type="button" onClick={() => insert(k)} className="rounded-full border border-paper-line px-2.5 py-0.5 font-mono hover:border-primary hover:text-primary">{`{${k}}`}</button>)}</div>
          <textarea id="msg-body" ref={bodyRef} rows={10} value={body} maxLength={8000} onChange={(e) => { setBody(e.target.value); changed(); }} className={`${input} leading-relaxed`} />
          <p className="mt-1 text-xs text-ink-muted">Plain text. Leave a blank line between paragraphs. The reference number is shown in every email automatically. Links can push mail into Spam; use them sparingly.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy || !subject || body.trim().length < 10} onClick={doPreview} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy && !pv ? "Working…" : "Preview"}</button>
          {pv && <button type="button" disabled={busy || off} onClick={doTest} className="rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary disabled:opacity-50">Send a test to me</button>}
        </div>
        {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm font-semibold ${msg.tone === "err" ? "bg-danger-bg text-danger-fg" : "bg-lime/40 text-night"}`}>{msg.text}</p>}

        {pv && (
          <div className="space-y-3 rounded-lg border-2 border-primary p-4" aria-live="polite">
            <p className="font-semibold">{pv.count === 0 ? "Nobody is in this group." : `${pv.label}: ${pv.count.toLocaleString("en-GB")} ${pv.count === 1 ? "person" : "people"} (one email each, submitted applications only).`}</p>
            {pv.notFound.length > 0 && <p className="text-sm text-warn-fg">Not found ({pv.notFound.length}): {pv.notFound.slice(0, 10).join(", ")}{pv.notFound.length > 10 ? "…" : ""}</p>}
            {pv.count > 0 && <>
              <details className="text-sm"><summary className="cursor-pointer font-semibold">First {pv.sample.length} recipients</summary><ul className="mt-1 space-y-0.5">{pv.sample.map((s) => <li key={s.applicationId} className="flex flex-wrap gap-x-3"><span className="font-mono text-xs text-ink-muted">{s.applicationId}</span><span>{s.name}</span><span className="text-ink-muted">{s.email}</span></li>)}</ul></details>
              {pv.email && <div><p className="text-sm"><span className="text-ink-muted">To</span> {pv.email.to} · <span className="text-ink-muted">Subject</span> <strong>{pv.email.subject}</strong></p>
                <iframe title="Email preview" sandbox="" srcDoc={pv.email.html} className="mt-2 h-[460px] w-full rounded-md border border-paper-line bg-white" /></div>}
              {!confirming ? <button type="button" disabled={off} onClick={() => setConfirming(true)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Send to {pv.count.toLocaleString("en-GB")}…</button>
                : <div className="rounded-md bg-warn-bg p-3 text-sm text-warn-fg">
                    <p className="font-semibold">Send this to {pv.count.toLocaleString("en-GB")} people from {ov.from}? Emails cannot be recalled once sent.</p>
                    {pv.count > ov.dailyLimit - ov.sentToday && <p className="mt-1">Only {Math.max(0, ov.dailyLimit - ov.sentToday)} can go today; the rest continue when you press Continue tomorrow.</p>}
                    <div className="mt-2 flex gap-3"><button type="button" disabled={busy} onClick={doCreate} className="rounded-full bg-primary px-5 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Starting…" : "Yes, send"}</button><button type="button" onClick={() => setConfirming(false)} className="rounded-full border border-paper-line bg-white px-5 py-2 font-semibold text-ink">Not yet</button></div>
                  </div>}
            </>}
          </div>
        )}
      </section>

      <section aria-labelledby="sent-h" className="space-y-3">
        <div className="flex items-center justify-between"><h2 id="sent-h" className="font-display text-xl font-extrabold">Messages</h2><button type="button" onClick={refresh} className="text-sm font-semibold text-primary underline">Refresh</button></div>
        {running && <p className="rounded-md bg-primary/5 px-3 py-2 text-sm">Sending… keep this page open. You can pause at any time; nobody receives the same message twice.</p>}
        {ov.campaigns.length === 0 ? <p className="text-sm text-ink-muted">No messages yet.</p> : (
          <ul className="divide-y divide-paper-line rounded-lg border border-paper-line bg-white">
            {ov.campaigns.map((c) => {
              const pct = c.total ? Math.round(((c.total - c.remaining) / c.total) * 100) : 0;
              return (
                <li key={c.campaignId} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">{c.subject}</p><p className="font-mono text-xs text-ink-muted">{c.campaignId} · {new Date(c.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {c.createdBy}</p></div>
                  <p className="text-sm text-ink-soft">{c.audience}</p>
                  <div className="flex items-center gap-3 text-sm tabular-nums"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-line"><span className="block h-full bg-primary" style={{ width: `${pct}%` }} /></span>{c.sent} sent{c.failed ? ` · ${c.failed} failed` : ""}{c.remaining ? ` · ${c.remaining} to go` : ""}</div>
                  {stopNote[c.campaignId] && <p className="text-sm text-ink-soft">{stopNote[c.campaignId]}</p>}
                  {c.lastErrors.length > 0 && <details className="text-xs text-danger-fg"><summary className="cursor-pointer">Recent errors</summary><ul className="list-disc pl-5">{c.lastErrors.map((e) => <li key={e}>{e}</li>)}</ul></details>}
                  {c.cancelled ? <p className="text-sm font-semibold text-ink-muted">Cancelled</p> : c.remaining > 0 && (
                    <div className="flex gap-2 text-sm">
                      {running === c.campaignId ? <button type="button" onClick={() => { stopFlag.current = true; }} className="rounded-full border border-paper-line px-4 py-1.5 font-semibold">Pause</button>
                        : <button type="button" disabled={!!running || off} onClick={() => run(c.campaignId)} className="rounded-full bg-primary px-4 py-1.5 font-semibold text-white disabled:opacity-50">Continue sending</button>}
                      <button type="button" onClick={() => { if (window.confirm(`Cancel "${c.subject}"? Nobody else will receive it.`)) cancel(c.campaignId); }} className="rounded-full border border-paper-line px-4 py-1.5 font-semibold text-danger-fg">Cancel</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
