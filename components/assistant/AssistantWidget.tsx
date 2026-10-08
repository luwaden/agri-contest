"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface Msg { role: "user" | "assistant"; content: string; mode?: string; related?: string[] }
interface Who { audience: "public" | "panel" | "admin"; role: string | null; suggestions: string[]; ai: boolean }

const TITLE = { public: "Ask about the contest", panel: "Ask about scoring and the process", admin: "Ask about the programme or applicants" } as const;

/**
 * Help assistant for every kind of user: visitors, applicants, mentors, judges, reviewers, coordinators and admins.
 * What it can answer depends on who is signed in (decided on the SERVER, never in this component).
 */
export function AssistantWidget() {
  const path = usePathname() || "";
  // On the application form the mobile action bar sits at the bottom; keep the button clear of it.
  const lift = path.startsWith("/apply") && !path.startsWith("/apply/success") ? "bottom-24 sm:bottom-6" : "bottom-4 sm:bottom-6";
  const [open, setOpen] = useState(false);
  // Shown to signed-in staff only (unless NEXT_PUBLIC_ASSISTANT_PUBLIC=true). Decided after mount, so nothing flashes.
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(process.env.NEXT_PUBLIC_ASSISTANT_PUBLIC === "true" || document.cookie.split("; ").includes("agri_staff=1")); }, [path]);
  const [who, setWho] = useState<Who | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null); const opener = useRef<HTMLButtonElement>(null); const end = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open && !who) fetch("/api/assistant").then((r) => r.json()).then((d) => { if (d.enabled === false) { setVisible(false); setOpen(false); } else setWho(d); }).catch(() => setWho({ audience: "public", role: null, suggestions: [], ai: false })); }, [open, who]);
  useEffect(() => { if (open) input.current?.focus(); end.current?.scrollIntoView({ block: "end" }); }, [open, msgs, busy]);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); opener.current?.focus(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open]);

  const send = useCallback(async (q: string) => {
    const question = q.trim(); if (!question || busy) return;
    const history = msgs.slice(-6).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: question }]); setText(""); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, history }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 429) throw new Error("You have asked a lot of questions. Please wait a few minutes.");
      if (!r.ok) throw new Error(d.message || "Sorry, I could not answer just now. Please try again.");
      setMsgs((m) => [...m, { role: "assistant", content: d.answer, mode: d.mode, related: d.related }]);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [busy, msgs]);

  if (!visible) return null;
  return (
    <div className="no-print">
      {!open && (
        <button ref={opener} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
          className={`fixed ${lift} right-4 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-[15px] font-bold text-white shadow-lift transition hover:bg-primary-800 focus-visible:ring-4 focus-visible:ring-sun sm:right-6`}>
          <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-sun text-sm text-night">?</span>Ask
        </button>
      )}
      {open && (
        <section role="dialog" aria-label={who ? TITLE[who.audience] : "Assistant"} aria-modal="false"
          className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(640px,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-[1.5rem] border border-paper-line bg-white shadow-lift sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[400px]">
          <header className="flex items-start justify-between gap-3 bg-primary px-5 py-4 text-white">
            <div><h2 className="font-display text-lg !text-white">{who ? TITLE[who.audience] : "Ask"}</h2>
              <p className="text-xs text-white/80">{who?.role ? `Signed in as ${who.role.toLowerCase()}` : "Open to everyone"}{who && !who.ai ? " · quick answers" : ""}</p></div>
            <button type="button" onClick={() => { setOpen(false); opener.current?.focus(); }} aria-label="Close assistant" className="rounded-full p-1.5 text-xl leading-none hover:bg-white/15">×</button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.length === 0 && (
              <div>
                <p className="text-sm text-ink-soft">Hello. Ask me anything about {who?.audience === "panel" ? "scoring and the judging process" : who?.audience === "admin" ? "using the programme tools, or the applicants" : "applying to the contest"}. To check an application, type its reference number.</p>
                <div className="mt-3 flex flex-wrap gap-2">{(who?.suggestions ?? []).map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-primary/30 bg-paper-warm px-3 py-1.5 text-left text-[13px] font-medium text-primary hover:bg-lime/50">{s}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
                <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed ${m.role === "user" ? "bg-primary text-white" : "bg-paper-warm text-ink"}`}>
                  {m.content}
                  {m.related && m.related.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{m.related.map((r) => <button key={r} type="button" onClick={() => send(r)} className="rounded-full border border-primary/30 bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-lime/50">{r}</button>)}</div>}
                </div>
              </div>
            ))}
            {busy && <p className="text-sm text-ink-muted" role="status">Thinking…</p>}
            {err && <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm font-medium text-danger-fg">{err}</p>}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex gap-2 border-t border-paper-line bg-white p-3">
            <label htmlFor="assistant-input" className="sr-only">Your question</label>
            <input id="assistant-input" ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder="Type your question…" autoComplete="off"
              className="min-w-0 flex-1 rounded-full border border-neutral-300 px-4 py-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25" />
            <button type="submit" disabled={busy || !text.trim()} className="rounded-full bg-sun px-5 py-2.5 text-sm font-bold text-night transition hover:bg-lime disabled:opacity-50">Send</button>
          </form>
        </section>
      )}
    </div>
  );
}
