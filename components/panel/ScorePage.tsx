import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { PanelShell } from "./PanelShell";
import { ScoreSheet } from "./ScoreSheet";
import { openForScoring } from "@/lib/services/reviewService";
import { passState } from "@/lib/services/screeningService";
import { PassButton } from "./PassButton";
import { ACTIVE_CRITERIA } from "@/lib/judging";
import { REFERENCE_PATTERN } from "@/lib/reference";
import * as L from "@/lib/labels";
import type { SessionUser } from "@/types/user";

function Block({ title, rows }: { title: string; rows: Array<[string, React.ReactNode]> }) {
  return (
    <section className="rounded-card border border-paper-line bg-white">
      <h2 className="border-b border-paper-line px-5 py-3 font-display text-lg font-extrabold text-primary">{title}</h2>
      <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-[180px_1fr]">
        {rows.map(([k, v]) => <Fragment key={k}><dt className="text-sm text-ink-muted">{k}</dt><dd className="whitespace-pre-wrap break-words text-[15px] text-ink">{v === "" || v == null ? "—" : v}</dd></Fragment>)}
      </dl>
    </section>
  );
}

/** One assigned application + the person's own score sheet. Anything not assigned to them is a plain 404. */
export async function ScorePage({ user, id, base }: { user: SessionUser; id: string; base: string }) {
  if (!REFERENCE_PATTERN.test(id)) notFound();
  const data = await openForScoring(user, id);
  if (!data) notFound();
  const { application: a, review, position } = data; const b = a.business, i = a.impact;
  const prev = position.index > 0 ? position.ids[position.index - 1] : null, next = position.index >= 0 && position.index < position.ids.length - 1 ? position.ids[position.index + 1] : null;
  const ps = await passState(user);
  const fileHref = (url: string) => (url.startsWith("https://res.cloudinary.com/") ? `/api/admin/files?url=${encodeURIComponent(url)}` : url);
  return (
    <PanelShell user={user}>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href={base} className="font-semibold text-primary hover:underline">← My applications</Link>
        <div className="flex items-center gap-3">
          {position.index >= 0 && <span className="text-ink-muted tabular-nums">{position.index + 1} of {position.ids.length}</span>}
          {prev && <Link href={`${base}/${prev}`} className="rounded-full border border-paper-line bg-white px-3 py-1 font-semibold text-primary hover:border-primary">← Previous</Link>}
          {next && <Link href={`${base}/${next}`} className="rounded-full border border-paper-line bg-white px-3 py-1 font-semibold text-primary hover:border-primary">Next →</Link>}
        </div>
      </div>

      <div className="mt-4">
        <p className="font-mono text-sm text-ink-muted">{a.applicationId}</p>
        <h1 className="font-display text-3xl font-extrabold text-primary">{b.businessName}</h1>
        <p className="text-ink-soft">{a.applicantName} · {a.lga ? `${a.lga}, ` : ""}{a.state} · {L.valueChainLabel(b.valueChain)}{b.valueChainOther ? ` (${b.valueChainOther})` : ""}</p>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <Block title="The innovation" rows={[["Description", b.description], ["Problem it solves", b.problem], ["Solution", b.solution], ["What is different", b.originality], ["What is innovative", b.innovation]]} />
          <Block title="Market and business" rows={[
            ["Stage", L.stageLabel(b.stage)], ["Year started", b.yearStarted], ["Registration", L.registrationLabel(b.registrationStatus)], ["Applicant's role", L.roleLabel(b.applicantRole)],
            ["Main customers", b.mainCustomers], ["Target market", b.targetMarket], ["Customers served", b.customersServed],
            ["Revenue", b.generatesRevenue ? L.revenueLabel(b.revenueRange) : "Not yet earning"], ["Revenue source", b.revenueSource],
            ["Team", `${b.employees.fullTime} full-time · ${b.employees.partTime} part-time · ${b.employees.youth} young people · ${b.employees.women} women`],
            ["Rural or urban", L.settingLabel(b.setting)], ["Website", b.website], ["Social media", b.socialHandles],
          ]} />
          <Block title="Impact" rows={[
            ["Farmers reached", i.farmersReached], ["Jobs created", i.jobsCreated], ["Women reached", i.womenReached], ["Young people reached", i.youthReached],
            ["Rural communities", i.communitiesReached], ["People benefited", i.peopleBenefited], ["Measurable change", i.socialImpact], ["Who benefits most", i.beneficiaries],
            ["Agricultural impact", i.agriImpactAreas.map(L.agriImpactLabel).join(", ")], ["Detail", i.environmentalImpact],
          ]} />
          <Block title="Support and goals" rows={[["Support needed", a.supportNeeds.map(L.supportLabel).join(", ")], ["Goal for the programme", a.programmeGoal]]} />
          <Block title="Documents" rows={a.documents.length ? a.documents.map((d): [string, React.ReactNode] => [L.documentLabel(d.kind), <a key={d.url} href={fileHref(d.url)} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-azure underline">Open</a>]) : [["Documents", "None provided"]]} />
          <p className="text-xs text-ink-muted">Contact details, address and date of birth are hidden from panel members on purpose.</p>
        </div>
        <div className="space-y-4 lg:sticky lg:top-6">
          {ps && review.status !== "CONFLICT" && (
            <div className="rounded-card border border-paper-line bg-white p-4">
              <p className="text-sm font-semibold text-primary">Next stage</p>
              <p className="mb-3 mt-0.5 text-sm text-ink-soft">You have passed {ps.passed} of {ps.limit}. You can change your mind until the round closes.</p>
              <PassButton applicationId={a.applicationId} passed={review.decision === "PASS"} count={ps.passed} limit={ps.limit} />
            </div>
          )}
          <ScoreSheet applicationId={a.applicationId} applicantName={a.applicantName} initial={review} criteria={ACTIVE_CRITERIA} backHref={base} nextHref={next ? `${base}/${next}` : null} />
        </div>
      </div>
    </PanelShell>
  );
}
