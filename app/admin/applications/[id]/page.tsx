import type { Metadata } from "next";
import { PortalShell } from "@/components/admin/PortalShell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/server";
import { can } from "@/lib/auth/permissions";
import { loadApplication } from "@/lib/data";
import { REFERENCE_PATTERN } from "@/lib/reference";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusSelect } from "@/components/admin/StatusSelect";
import { PrintButton } from "@/components/admin/PrintButton";
import { DEFAULT_CRITERIA } from "@/config/scoring";
import * as L from "@/lib/labels";
import { Fragment } from "react";

export const metadata: Metadata = { title: "Application", robots: { index: false } };
export const dynamic = "force-dynamic";

function Section({ title, rows }: { title: string; rows: Array<[string, React.ReactNode]> }) {
  return (
    <section className="break-inside-avoid rounded-lg border border-paper-line bg-white">
      <h2 className="border-b border-paper-line px-5 py-3 font-display text-lg font-semibold">{title}</h2>
      <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-[200px_1fr]">
        {rows.map(([k, v]) => <Fragment key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="whitespace-pre-wrap break-words text-[15px] text-forest-900">{v === "" || v == null ? "—" : v}</dd></Fragment>)}
      </dl>
    </section>
  );
}

export default async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("applications:view");
  const { id } = await params;
  if (!REFERENCE_PATTERN.test(id)) notFound();
  const { application: a, demo } = await loadApplication(id);
  if (!a) notFound();
  const b = a.business, i = a.impact;
  return (
    <PortalShell>
    <div className="space-y-6">
      <div className="no-print"><Link href="/admin/applications" className="text-sm font-semibold text-leaf-800 hover:underline">← All applications</Link></div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-ink-muted">{a.applicationId}</p>
          <h1 className="font-display text-3xl font-semibold">{b.businessName}</h1>
          <p className="text-ink-soft">{a.applicant.firstName} {a.applicant.middleName} {a.applicant.lastName} · {a.location.state}</p>
        </div>
        <div className="flex items-center gap-3"><StatusBadge status={a.submissionStatus} />
          {can(user.role, "applications:status") && !demo && <StatusSelect id={a.applicationId} status={a.submissionStatus} />}
          <PrintButton /></div>
      </div>

      <Section title="Applicant profile" rows={[
        ["Name", `${a.applicant.firstName} ${a.applicant.middleName} ${a.applicant.lastName}`.replace(/\s+/g, " ")], ["Gender", L.genderLabel(a.applicant.gender)],
        ["Date of birth", `${a.applicant.dateOfBirth} (${a.applicant.age} years at submission)`], ["Phone", a.applicant.phone], ["WhatsApp", a.applicant.whatsapp],
        ["Email", a.applicant.email], ["Nationality", a.applicant.nationality],
        ["Residence", `${a.applicant.community}, ${a.location.lga}, ${a.location.state}`], ["Address", a.applicant.address],
        ["Location group", L.groupLabel(a.location.locationGroup)], ["Languages", a.languages.join(", ")],
      ]} />
      <Section title="Business" rows={[
        ["Business name", b.businessName], ["Value chain", L.valueChainLabel(b.valueChain) + (b.valueChainOther ? ` · ${b.valueChainOther}` : "")],
        ["Stage", L.stageLabel(b.stage)], ["Applicant role", L.roleLabel(b.applicantRole) + (b.applicantRoleOther ? ` · ${b.applicantRoleOther}` : "")],
        ["Registration", L.registrationLabel(b.registrationStatus) + (b.registrationNumber ? ` · ${b.registrationNumber}` : "")], ["Year started", b.yearStarted],
        ["Location", `${b.address}, ${b.lga}, ${b.state} (${L.settingLabel(b.setting)})`], ["Website", b.website], ["Social media", b.socialHandles],
        ["Revenue", b.generatesRevenue ? L.revenueLabel(b.revenueRange) : "Not yet earning"], ["Revenue source", b.revenueSource],
        ["Customers served", b.customersServed], ["Main customers", b.mainCustomers], ["Target market", b.targetMarket],
        ["Employees", `${b.employees.fullTime} full-time · ${b.employees.partTime} part-time · ${b.employees.youth} young people · ${b.employees.women} women`],
      ]} />
      <Section title="Innovation" rows={[["Description", b.description], ["Problem", b.problem], ["Solution", b.solution], ["What is different", b.originality], ["What is innovative", b.innovation]]} />
      <Section title="Impact" rows={[
        ["Farmers reached", i.farmersReached], ["Jobs created", i.jobsCreated], ["Women reached", i.womenReached], ["Youth reached", i.youthReached],
        ["Rural communities reached", i.communitiesReached], ["People benefited", i.peopleBenefited],
        ["Measurable change", i.socialImpact], ["Who benefits most", i.beneficiaries],
        ["Agricultural impact areas", i.agriImpactAreas.map(L.agriImpactLabel).join(", ")], ["Agricultural impact detail", i.environmentalImpact],
      ]} />
      <Section title="Inclusion" rows={[
        ["Person with a disability", L.disabilityLabel(a.inclusion.disability)], ["Type", L.disabilityTypeLabel(a.inclusion.disabilityType)], ["Accessibility support", a.inclusion.accessibilityNeeds],
        ["Residence", L.settingLabel(a.inclusion.residenceSetting)], ["Counted as rural", a.inclusion.rural ? "Yes" : "No"],
      ]} />
      <Section title="Programme needs" rows={[["Support needed", a.supportNeeds.map(L.supportLabel).join(", ") + (a.supportNeedsOther ? ` · ${a.supportNeedsOther}` : "")], ["Goal for the programme", a.programmeGoal]]} />
      <Section title="Documents" rows={a.documents.length ? a.documents.map((d): [string, React.ReactNode] => [L.documentLabel(d.kind), <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer" className="text-leaf-800 underline">{d.url}</a>]) : [["Supporting links", "None provided"]]} />
      <Section title="Administrative information" rows={[
        ["Status", L.formatDateTime(a.submittedAt) === "—" ? a.submissionStatus : a.submissionStatus], ["Submitted", L.formatDateTime(a.submittedAt)], ["Created", L.formatDateTime(a.metadata.createdAt)],
        ["Last updated", L.formatDateTime(a.metadata.updatedAt)], ["Source", a.metadata.source], ["Declaration accepted", a.declaration.accepted ? `Yes · ${L.formatDateTime(a.declaration.acceptedAt)}` : "No"],
      ]} />
      <Section title="Scoring" rows={[
        ["Average score", a.score ?? "Not scored yet"],
        ["Rubric", `${DEFAULT_CRITERIA.filter((c) => c.active).length} draft criteria configured. Judging opens in a later batch, and scores will be shown per judge.`],
      ]} />
    </div>
    </PortalShell>
  );
}
