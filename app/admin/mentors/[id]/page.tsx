import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { PortalShell } from "@/components/admin/PortalShell";
import { MentorStatusBadge, MentorStatusSelect } from "@/components/admin/MentorTable";
import { PrintButton } from "@/components/admin/PrintButton";
import { requirePagePermission } from "@/lib/auth/server";
import { getMentor } from "@/lib/services/mentorService";
import { MENTOR_AREAS, MENTOR_AVAILABILITY } from "@/config/mentors";
import { MENTOR_REFERENCE_PATTERN } from "@/lib/reference";
import { formatDateTime } from "@/lib/labels";

export const metadata: Metadata = { title: "Mentor application", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MentorDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("mentors:review");
  const { id } = await params;
  if (!MENTOR_REFERENCE_PATTERN.test(id)) notFound();
  const m = await getMentor(id); if (!m) notFound();
  const rows: Array<[string, React.ReactNode]> = [
    ["Email", m.email], ["Phone", m.phone], ["Based in", `${m.location}, ${m.state}`], ["Profession", m.profession], ["Organisation", m.organization], ["Industry", m.industry],
    ["Years of experience", m.yearsExperience], ["Mentoring experience", m.mentorshipExperience], ["Can mentor in", m.expertise.map((e) => MENTOR_AREAS.find((a) => a.value === e)?.label ?? e).join(", ")],
    ["Availability", MENTOR_AVAILABILITY.find((a) => a.value === m.availability)?.label ?? m.availability], ["Availability notes", m.availabilityNotes], ["Motivation", m.motivation],
    ["LinkedIn", m.linkedin && <a key="l" href={m.linkedin} target="_blank" rel="noopener noreferrer" className="text-azure underline">{m.linkedin}</a>],
    ["Portfolio", m.portfolio && <a key="p" href={m.portfolio} target="_blank" rel="noopener noreferrer" className="text-azure underline">{m.portfolio}</a>],
    ["Documents", m.documents.length ? m.documents.map((d) => <a key={d.url} href={`/api/admin/files?url=${encodeURIComponent(d.url)}`} target="_blank" rel="noopener noreferrer" className="block text-azure underline">{d.kind} (open securely)</a>) : "None"],
    ["Received", formatDateTime(m.submittedAt)],
  ];
  return (
    <PortalShell>
      <div className="space-y-6">
        <Link href="/admin/mentors" className="no-print text-sm font-bold text-azure hover:underline">← All mentor applications</Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="font-mono text-sm text-ink-muted">{m.mentorId}</p><h1 className="font-display text-3xl text-primary">{m.fullName}</h1></div>
          <div className="flex items-center gap-3"><MentorStatusBadge status={m.status} /><MentorStatusSelect id={m.mentorId} status={m.status} /><PrintButton /></div>
        </div>
        <section className="rounded-card border border-paper-line bg-white"><dl className="grid gap-x-6 gap-y-3 px-5 py-5 sm:grid-cols-[200px_1fr]">
          {rows.map(([k, v]) => <Fragment key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="whitespace-pre-wrap break-words text-[15px] text-forest-900">{v === "" || v == null ? "—" : v}</dd></Fragment>)}
        </dl></section>
      </div>
    </PortalShell>
  );
}
