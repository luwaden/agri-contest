"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { MENTOR_AREAS, MENTOR_STATUSES, PANEL_ROLES } from "@/config/mentors";
import { formatDate } from "@/lib/labels";

interface Row { mentorId: string; fullName: string; organization: string; profession: string; state: string; yearsExperience: number; expertise: string[]; availability: string; status: string; submittedAt: string; roles?: string[] }
const roleLabel = (v: string) => PANEL_ROLES.find((r) => r.value === v)?.label ?? v;
const label = (v: string) => MENTOR_AREAS.find((a) => a.value === v)?.label ?? v;

export function MentorStatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = { NEW: "bg-sun text-night", UNDER_REVIEW: "bg-azure text-white", ACCEPTED: "bg-lime text-night", DECLINED: "bg-neutral-200 text-ink-soft" };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${tone[status] ?? tone.NEW}`}>{MENTOR_STATUSES.find((s) => s.value === status)?.label ?? status}</span>;
}

export function MentorStatusSelect({ id, status }: { id: string; status: string }) {
  const [v, setV] = useState(status); const [msg, setMsg] = useState("");
  async function change(next: string) {
    const prev = v; setV(next); setMsg("");
    const r = await fetch(`/api/admin/mentors/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    if (r.ok) setMsg("Updated"); else { setV(prev); setMsg((await r.json().catch(() => ({}))).message || "Could not update"); }
  }
  return (<span className="inline-flex flex-col"><label className="sr-only" htmlFor={`m-${id}`}>Change status for {id}</label>
    <select id={`m-${id}`} value={v} onChange={(e) => change(e.target.value)} className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm">{MENTOR_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
    <span role="status" className="min-h-[1rem] text-xs text-ink-muted">{msg}</span></span>);
}

export function MentorTable() {
  const [rows, setRows] = useState<Row[] | null>(null); const [error, setError] = useState(false);
  const load = useCallback(async () => { setError(false); try { const r = await fetch("/api/admin/mentors", { cache: "no-store" }); if (r.status === 401) { window.location.href = "/admin/login"; return; } if (!r.ok) throw new Error(); setRows((await r.json()).mentors); } catch { setError(true); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message="We couldn't load the mentor applications right now. Please try again." onRetry={load} />;
  if (!rows) return <LoadingState label="Loading mentor applications" rows={5} />;
  if (rows.length === 0) return <EmptyState title="No mentor applications yet." body="Applications from the Call for Experts page will appear here." />;
  return (
    <div className="overflow-x-auto rounded-card border border-paper-line bg-white">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-primary text-left text-xs text-white"><tr>{["Reference", "Name", "Applying as", "Role & organisation", "Based in", "Years", "Expertise", "Status", "Received", "Actions"].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-paper-line">
          {rows.map((m) => (
            <tr key={m.mentorId} className="align-top hover:bg-paper-warm/60">
              <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{m.mentorId}</td><td className="px-3 py-3 font-semibold text-primary">{m.fullName}</td>
              <td className="px-3 py-3 text-xs font-semibold text-primary">{(m.roles?.length ? m.roles : ["MENTOR"]).map(roleLabel).join(", ")}</td><td className="px-3 py-3">{m.profession}{m.organization ? <span className="block text-xs text-ink-muted">{m.organization}</span> : null}</td><td className="px-3 py-3">{m.state}</td><td className="px-3 py-3 tabular-nums">{m.yearsExperience}</td>
              <td className="max-w-[260px] px-3 py-3 text-xs">{m.expertise.map(label).join(", ")}</td><td className="px-3 py-3"><MentorStatusBadge status={m.status} /></td>
              <td className="whitespace-nowrap px-3 py-3">{formatDate(m.submittedAt)}</td>
              <td className="px-3 py-3"><div className="flex items-start gap-3"><Link href={`/admin/mentors/${m.mentorId}`} className="font-bold text-azure hover:underline">View</Link><MentorStatusSelect id={m.mentorId} status={m.status} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
