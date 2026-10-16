"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postScreening } from "./post";

type Item = { reviewId: string; applicationId: string; businessName: string; state: string; valueChain: string; aiScore: number | null; status: string; decision: "PASS" | null; total: number | null };
type Person = { email: string; name: string; assigned: number; passed: number; submitted: number; items: Item[] };

const STATUS: Record<string, string> = { ASSIGNED: "Not opened", IN_PROGRESS: "Started", SUBMITTED: "Scored" };
const movable = (i: Item) => i.decision !== "PASS" && i.status !== "SUBMITTED";

/**
 * Step 3 (and the judges' round): who has what. Tick applications, choose a person (or "share evenly"), press Move.
 * Passed and scored applications cannot be ticked, so work that is done is never moved by accident.
 */
export function AssignmentBoard({ people, passLimit, role }: { people: Person[]; passLimit: number | null; role: "REVIEWER" | "JUDGE" }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [to, setTo] = useState("EVEN");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string; details?: string[] } | null>(null);
  const word = role === "JUDGE" ? "judge" : "reviewer";
  const owner = useMemo(() => { const m = new Map<string, string>(); for (const p of people) for (const i of p.items) m.set(i.reviewId, p.email); return m; }, [people]);
  const fromPeople = new Set([...picked].map((id) => owner.get(id)));
  // Never offer "move to the person it already belongs to": fall back to sharing evenly.
  const target = fromPeople.size === 1 && fromPeople.has(to) ? "EVEN" : to;

  const flip = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectAll = (p: Person) => setPicked((s) => { const n = new Set(s); p.items.filter(movable).forEach((i) => n.add(i.reviewId)); return n; });

  async function move() {
    setBusy(true); setMsg(null);
    const r = await postScreening<{ moved: number; skipped: string[] }>({ action: "move", reviewIds: [...picked], to: target });
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "err", text: r.error, details: (r.data?.skipped as string[] | undefined) ?? [] }); return; }
    setMsg({ tone: "ok", text: `Moved ${r.data.moved} application(s).${r.data.skipped.length ? ` ${r.data.skipped.length} were left where they were:` : ""}`, details: r.data.skipped });
    setPicked(new Set()); setTo("EVEN"); router.refresh();
  }

  if (!people.length) return <p className="text-sm text-ink-muted">No {word}s yet.</p>;

  return (
    <div className="space-y-3">
      {msg && <div role={msg.tone === "err" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${msg.tone === "err" ? "bg-danger-bg text-danger-fg" : "bg-lime/40 text-night"}`}>
        <p className="font-semibold">{msg.text}</p>{msg.details?.length ? <ul className="mt-1 list-disc pl-5">{msg.details.slice(0, 10).map((d) => <li key={d}>{d}</li>)}</ul> : null}</div>}

      <ul className="divide-y divide-paper-line rounded-lg border border-paper-line bg-white">
        {people.map((p) => {
          const isOpen = open === p.email;
          const pct = passLimit ? Math.min(100, Math.round((p.passed / passLimit) * 100)) : p.assigned ? Math.round((p.submitted / p.assigned) * 100) : 0;
          return (
            <li key={p.email}>
              <button type="button" onClick={() => setOpen(isOpen ? null : p.email)} aria-expanded={isOpen}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-paper-warm/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <span className="min-w-0 flex-1"><span className="font-semibold">{p.name}</span> <span className="text-xs text-ink-muted">{p.email}</span></span>
                <span className="text-sm tabular-nums text-ink-soft">{p.assigned} assigned</span>
                <span className="flex w-44 items-center gap-2 text-sm tabular-nums">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-line"><span className="block h-full bg-primary" style={{ width: `${pct}%` }} /></span>
                  {passLimit ? `${p.passed}/${passLimit} passed` : `${p.submitted} scored`}
                </span>
                <span aria-hidden className="text-ink-muted">{isOpen ? "▴" : "▾"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-paper-line px-4 pb-4 pt-2">
                  {p.items.length === 0 ? <p className="py-2 text-sm text-ink-muted">Nothing assigned.</p> : <>
                    <div className="mb-2 flex flex-wrap gap-2 text-sm">
                      <button type="button" onClick={() => selectAll(p)} className="rounded-full border border-paper-line px-3 py-1 font-semibold hover:border-primary">Tick everything not yet done</button>
                      <button type="button" onClick={() => setPicked((s) => { const n = new Set(s); p.items.forEach((i) => n.delete(i.reviewId)); return n; })} className="rounded-full border border-paper-line px-3 py-1 font-semibold hover:border-primary">Clear</button>
                    </div>
                    <div className="max-h-96 overflow-auto rounded-md border border-paper-line">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-paper-warm text-left text-xs text-ink-muted"><tr><th className="w-8 px-2 py-2"><span className="sr-only">Select</span></th><th className="px-2 py-2">Application</th><th className="hidden px-2 py-2 sm:table-cell">State</th><th className="px-2 py-2 text-right">Pre-score</th><th className="px-2 py-2">Progress</th></tr></thead>
                        <tbody className="divide-y divide-paper-line">
                          {p.items.map((i) => (
                            <tr key={i.reviewId} className={picked.has(i.reviewId) ? "bg-primary/5" : ""}>
                              <td className="px-2 py-1.5"><input type="checkbox" aria-label={`Select ${i.businessName}`} disabled={!movable(i)} checked={picked.has(i.reviewId)} onChange={() => flip(i.reviewId)} className="accent-primary" /></td>
                              <td className="px-2 py-1.5"><Link href={`/admin/applications/${i.applicationId}`} className="font-semibold underline-offset-2 hover:underline">{i.businessName}</Link> <span className="font-mono text-xs text-ink-muted">{i.applicationId}</span></td>
                              <td className="hidden px-2 py-1.5 sm:table-cell">{i.state}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{i.aiScore ?? "–"}</td>
                              <td className="px-2 py-1.5">{i.decision === "PASS" ? <span className="font-semibold text-primary">Passed</span> : i.status === "SUBMITTED" && i.total != null ? `Scored ${i.total}` : STATUS[i.status] ?? i.status}</td>
                            </tr>))}
                        </tbody>
                      </table>
                    </div></>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {picked.size > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border sm:mr-32 border-paper-line bg-white/95 p-3 shadow-lg backdrop-blur">
          <span className="text-sm font-semibold">{picked.size} ticked</span>
          <label className="flex flex-1 items-center gap-2 text-sm">Move to
            <select value={target} onChange={(e) => setTo(e.target.value)} className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
              <option value="EVEN">Share evenly among the other {word}s</option>
              {people.filter((p) => !(fromPeople.size === 1 && fromPeople.has(p.email))).map((p) => <option key={p.email} value={p.email}>{p.name} (has {p.assigned})</option>)}
            </select></label>
          <button type="button" disabled={busy} onClick={move} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Moving…" : "Move"}</button>
          <button type="button" onClick={() => setPicked(new Set())} className="rounded-full border border-paper-line px-4 py-2 text-sm font-semibold">Cancel</button>
        </div>
      )}
    </div>
  );
}
