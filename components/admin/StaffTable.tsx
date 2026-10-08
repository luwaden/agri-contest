"use client";
import { useState } from "react";
import { roleLabel } from "@/lib/auth/permissions";
import type { StaffRole } from "@/types/user";
import type { StaffSummary } from "@/types/staff";

const ROLES: StaffRole[] = ["ADMIN", "COORDINATOR", "JUDGE", "REVIEWER"];
const STATUS: Record<StaffSummary["status"], [string, string]> = {
  active: ["Active", "bg-lime text-night"], invited: ["Invited: no password yet", "bg-sun text-night"],
  deactivated: ["Deactivated", "bg-neutral-200 text-ink-soft"], damaged: ["Password damaged: send a reset link", "bg-danger-bg text-danger-fg"],
};
type Link = { link: string; expiresAt: string; label: string };

function LinkBox({ l, onCopy, copied }: { l: Link; onCopy: () => void; copied: boolean }) {
  return (
    <div className="space-y-1.5" role="status">
      <p className="text-xs font-semibold text-primary">{l.label}</p>
      <input readOnly value={l.link} aria-label={l.label} className="w-full rounded-md border border-paper-line bg-paper-warm px-2 py-1.5 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap items-center gap-3 text-xs"><button type="button" className="font-bold text-azure underline" onClick={onCopy}>{copied ? "Copied" : "Copy link"}</button>
        <span className="text-ink-muted">Works once · expires {new Date(l.expiresAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. Send it privately (WhatsApp, SMS or email).</span></div>
    </div>
  );
}

export function StaffTable({ staff: initial, linksOn, me }: { staff: StaffSummary[]; linksOn: boolean; me: string }) {
  const [staff, setStaff] = useState(initial);
  const [links, setLinks] = useState<Record<string, Link | string>>({});
  const [copied, setCopied] = useState(""); const [busy, setBusy] = useState(""); const [msg, setMsg] = useState("");
  const [added, setAdded] = useState<Link | null>(null);

  async function call(method: "POST" | "PATCH", url: string, body: unknown) {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || "Something went wrong.");
    return d;
  }
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
    setBusy("add"); setMsg(""); setAdded(null);
    try {
      const d = await call("POST", "/api/admin/staff", { name: f.get("name"), email: f.get("email"), role: f.get("role") });
      setStaff(d.staff); setAdded({ link: d.link, expiresAt: d.expiresAt, label: `Invite link for ${f.get("name")}: they open it and choose their password` }); form.reset();
    } catch (err) { setMsg((err as Error).message); } finally { setBusy(""); }
  }
  async function change(email: string, patch: { role?: StaffRole; active?: boolean }) {
    setBusy(email); setMsg("");
    try { const d = await call("PATCH", "/api/admin/staff", { email, ...patch }); setStaff(d.staff); }
    catch (err) { setMsg((err as Error).message); } finally { setBusy(""); }
  }
  async function makeLink(u: StaffSummary) {
    setLinks((l) => ({ ...l, [u.email]: "Creating…" }));
    try { const d = await call("POST", "/api/admin/password-reset", { email: u.email }); setLinks((l) => ({ ...l, [u.email]: { link: d.link, expiresAt: d.expiresAt, label: d.purpose === "invite" ? "Invite link (choose a password)" : "Reset link" } })); }
    catch (err) { setLinks((l) => ({ ...l, [u.email]: (err as Error).message })); }
  }
  const copy = async (key: string, text: string) => { await navigator.clipboard.writeText(text).catch(() => {}); setCopied(key); };
  const input = "mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

  return (
    <div className="space-y-6">
      {!linksOn && <p role="status" className="rounded-card border border-warn-line bg-warn-bg p-4 text-sm font-medium text-warn-fg">Invite and reset links need Redis (Upstash). Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN on Vercel and redeploy. Until then, add people with <code>npm run make-user</code>.</p>}

      <section aria-labelledby="add-h" className="rounded-card border border-paper-line bg-white p-5 sm:p-6">
        <h2 id="add-h" className="font-display text-xl text-primary">Add a person</h2>
        <p className="mt-1 text-sm text-ink-soft">They are saved in the <strong>Admin Users</strong> tab of the Google Sheet. You get a link to send them; they choose their own password. No redeploy needed.</p>
        <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1.4fr_1fr_auto] sm:items-end">
          <label className="text-sm font-medium">Full name<input name="name" required maxLength={80} autoComplete="off" className={input} /></label>
          <label className="text-sm font-medium">Email<input name="email" type="email" required autoComplete="off" className={input} /></label>
          <label className="text-sm font-medium">Role<select name="role" required defaultValue="REVIEWER" className={input}>{ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
          <button type="submit" disabled={!linksOn || busy === "add"} className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary-800 disabled:opacity-40">{busy === "add" ? "Adding…" : "Add and get link"}</button>
        </form>
        {added && <div className="mt-4"><LinkBox l={added} copied={copied === "added"} onCopy={() => copy("added", added.link)} /></div>}
      </section>

      {msg && <p role="alert" className="rounded-card border border-danger-line bg-danger-bg p-4 text-sm font-medium text-danger-fg">{msg}</p>}

      <div className="overflow-x-auto rounded-card border border-paper-line bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-primary text-left text-xs text-white"><tr>{["Name", "Email", "Role", "Status", "Password link", "Access"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-paper-line">
            {staff.map((u) => {
              const l = links[u.email]; const self = u.email === me; const locked = u.source === "env" || self;
              return (
                <tr key={u.email} className="align-top">
                  <td className="px-4 py-3 font-semibold text-primary">{u.name}{self && <span className="ml-2 text-xs font-normal text-ink-muted">(you)</span>}{u.source === "env" && <span className="mt-0.5 block text-xs font-normal text-ink-muted">set in Vercel settings</span>}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{locked ? roleLabel(u.role) : (
                    <><label className="sr-only" htmlFor={`role-${u.email}`}>Role for {u.name}</label>
                    <select id={`role-${u.email}`} value={u.role} disabled={busy === u.email} onChange={(e) => change(u.email, { role: e.target.value as StaffRole })} className="rounded-md border border-neutral-300 bg-white px-2 py-1.5">{ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></>)}</td>
                  <td className="px-4 py-3"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[u.status][1]}`}>{STATUS[u.status][0]}</span></td>
                  <td className="px-4 py-3">
                    {typeof l === "object" ? <LinkBox l={l} copied={copied === u.email} onCopy={() => copy(u.email, l.link)} />
                      : typeof l === "string" ? <span className="text-xs text-ink-muted" role="status">{l}</span>
                      : u.status === "deactivated" ? <span className="text-xs text-ink-muted">Reactivate first</span>
                      : <button type="button" disabled={!linksOn} onClick={() => makeLink(u)} className="rounded-full border-2 border-primary px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white disabled:opacity-40">{u.status === "invited" ? "New invite link" : "Create reset link"}</button>}
                  </td>
                  <td className="px-4 py-3">{locked ? <span className="text-xs text-ink-muted">{self ? "—" : "Change on Vercel"}</span> :
                    <button type="button" disabled={busy === u.email} onClick={() => change(u.email, { active: !u.active })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${u.active ? "border-2 border-danger-fg/60 text-danger-fg hover:bg-danger-bg" : "border-2 border-primary text-primary hover:bg-primary hover:text-white"}`}>{u.active ? "Deactivate" : "Reactivate"}</button>}</td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-ink-muted">Deactivating signs the person out at once. Role changes apply on their next click. Everything here is recorded in the audit log.</p>
    </div>
  );
}
