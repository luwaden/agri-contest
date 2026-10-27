"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Role = "REVIEWER" | "JUDGE";
type Candidate = { mentorId: string; name: string; email: string; state: string; profession: string; organization: string; appliedAs: string[]; status: string; submittedAt: string; suggestedRole: Role;
  account: { role: string; status: string } | null };
type Result = { mentorId: string; name: string; email: string; role: Role; outcome: "created" | "already" | "failed"; emailed: boolean; link?: string; message?: string };

const APPLIED: Record<string, string> = { MENTOR: "Mentor", JUDGE: "Judge", REVIEWER: "Reviewer" };
const ROLE_LABEL: Record<string, string> = { REVIEWER: "Reviewer", JUDGE: "Judge", ADMIN: "Administrator", COORDINATOR: "Coordinator" };

/** Panel applicants → staff accounts: tick, check the role, create; each person gets an email with their password link. */
export function PanelInvites({ candidates, linksOn }: { candidates: Candidate[]; linksOn: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<"new" | "all">("new");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [copied, setCopied] = useState("");

  const fresh = candidates.filter((c) => !c.account);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (view === "new" ? fresh : candidates).filter((c) => !s || [c.name, c.email, c.state, c.profession, c.organization].some((x) => x.toLowerCase().includes(s)));
  }, [candidates, fresh, view, q]);
  const selectable = shown.filter((c) => !c.account);
  const allTicked = selectable.length > 0 && selectable.every((c) => sel.includes(c.mentorId));
  const roleOf = (c: Candidate) => roles[c.mentorId] ?? c.suggestedRole;

  async function create() {
    if (!sel.length || busy) return;
    setBusy(true); setError(""); setResults(null);
    try {
      const people = candidates.filter((c) => sel.includes(c.mentorId)).map((c) => ({ mentorId: c.mentorId, role: roleOf(c) }));
      const res = await fetch("/api/admin/staff/panel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ people, send }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.message ?? `The server answered ${res.status}.`); return; }
      setResults(d.results); setSel([]); router.refresh();
    } catch { setError("Could not reach the server."); }
    finally { setBusy(false); }
  }

  const created = results?.filter((r) => r.outcome === "created") ?? [];
  return (
    <section aria-labelledby="panel-h" className="rounded-card border border-paper-line bg-white">
      <div className="border-b border-paper-line p-5 sm:p-6">
        <h2 id="panel-h" className="font-display text-xl text-primary">From panel applications</h2>
        <p className="mt-1 text-sm text-ink-soft">People who applied to be mentors, judges or reviewers. Tick who should get an account, check the role, then press <strong>Create accounts</strong>. Each person gets an email with a link to choose their password.</p>
      </div>

      {results && (
        <div className="space-y-2 border-b border-paper-line bg-leaf-50 p-5 sm:p-6" role="status">
          <p className="font-semibold text-forest-900">{created.length ? `${created.length} account${created.length === 1 ? "" : "s"} created${created.every((r) => r.emailed) ? ", invites emailed." : "."}` : "No new accounts were created."}</p>
          <ul className="space-y-2 text-sm">
            {results.map((r) => (
              <li key={r.mentorId} className="rounded-md bg-white px-3 py-2">
                <span className="font-medium">{r.name || r.mentorId}</span> <span className="text-ink-muted">{r.email}</span>{" · "}
                {r.outcome === "created" ? <span className="text-primary">{ROLE_LABEL[r.role]} account created{r.emailed ? ", invite emailed" : ""}</span>
                  : r.outcome === "already" ? <span className="text-ink-soft">already has an account</span> : <span className="text-danger-fg">not created: {r.message}</span>}
                {r.outcome === "created" && !r.emailed && r.link && (
                  <span className="mt-1 block text-xs"><span className="text-warn-fg">{r.message ?? "Send them this link yourself."}</span>{" "}
                    <button type="button" className="font-semibold text-primary underline" onClick={() => { void navigator.clipboard.writeText(r.link!).catch(() => {}); setCopied(r.mentorId); }}>{copied === r.mentorId ? "Copied" : "Copy invite link"}</button></span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidates.length === 0 ? <p className="p-6 text-sm text-ink-muted">No panel applications yet.</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2 px-5 pt-4 sm:px-6">
            {([["new", `No account yet`, fresh.length], ["all", "All applications", candidates.length]] as const).map(([v, l, n]) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => { setView(v); setSel([]); }}
                className={`rounded-full border px-3 py-1 text-sm ${view === v ? "border-primary bg-primary text-white" : "border-paper-line text-ink-soft hover:border-primary"}`}>{l} <span className="tabular-nums opacity-80">{n}</span></button>
            ))}
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, state or profession" aria-label="Search panel applications"
              className="ml-auto min-w-[220px] flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:flex-none" />
          </div>

          {shown.length === 0 ? <p className="px-6 py-8 text-center text-sm text-ink-muted">{view === "new" ? "Everyone who applied already has an account." : "Nothing matches."}</p> : (
            <ul className="mt-3 divide-y divide-paper-line border-t border-paper-line">
              {selectable.length > 0 && (
                <li className="flex items-center gap-3 bg-paper-warm px-5 py-2 text-xs text-ink-muted sm:px-6">
                  <input type="checkbox" aria-label="Tick everyone shown without an account" className="h-4 w-4 accent-leaf-700" checked={allTicked} onChange={(e) => setSel(e.target.checked ? selectable.map((c) => c.mentorId) : [])} />
                  Tick all {selectable.length} shown
                </li>
              )}
              {shown.map((c) => {
                const ticked = sel.includes(c.mentorId);
                return (
                  <li key={c.mentorId} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:px-6 ${ticked ? "bg-leaf-50/70" : ""}`}>
                    {c.account ? <span className="h-4 w-4" aria-hidden="true" /> : (
                      <input type="checkbox" aria-label={`Tick ${c.name}`} className="h-4 w-4 accent-leaf-700" checked={ticked} onChange={(e) => setSel((s) => (e.target.checked ? [...s, c.mentorId] : s.filter((x) => x !== c.mentorId)))} />
                    )}
                    <div className="min-w-0 flex-1 basis-60">
                      <p className="truncate font-medium text-forest-900">{c.name}</p>
                      <p className="truncate text-sm text-ink-muted">{c.email}</p>
                    </div>
                    <div className="min-w-0 basis-56 text-sm">
                      <p className="text-forest-900">Applied as {c.appliedAs.map((r) => APPLIED[r] ?? r).join(", ")}</p>
                      <p className="truncate text-ink-muted">{[c.state, c.profession].filter(Boolean).join(" · ")}{" · "}<Link href={`/admin/mentors/${c.mentorId}`} className="text-primary hover:underline">application</Link></p>
                    </div>
                    <div className="w-40 shrink-0 text-sm">
                      {c.account ? <span className="text-ink-soft">{ROLE_LABEL[c.account.role] ?? c.account.role} account{c.account.status === "invited" ? " · invited" : c.account.status === "deactivated" ? " · deactivated" : ""}</span> : (
                        <><label className="sr-only" htmlFor={`role-${c.mentorId}`}>Account role for {c.name}</label>
                        <select id={`role-${c.mentorId}`} value={roleOf(c)} onChange={(e) => setRoles((r) => ({ ...r, [c.mentorId]: e.target.value as Role }))} className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5">
                          <option value="REVIEWER">Reviewer</option><option value="JUDGE">Judge</option>
                        </select></>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-paper-line bg-white px-5 py-4 sm:px-6">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="h-4 w-4 accent-leaf-700" /> Email each person their invite</label>
            {error && <p role="alert" className="text-sm font-medium text-danger-fg">{error}</p>}
            <button type="button" disabled={!linksOn || busy || sel.length === 0} onClick={() => void create()}
              className="ml-auto min-h-[44px] rounded-full bg-primary px-6 text-sm font-bold text-white hover:bg-primary-800 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              {busy ? "Creating…" : sel.length ? `Create ${sel.length} account${sel.length === 1 ? "" : "s"}` : "Create accounts"}</button>
          </div>
        </>
      )}
    </section>
  );
}
