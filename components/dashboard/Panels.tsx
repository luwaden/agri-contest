import type { Analytics } from "@/lib/analytics/compute";
import { MetricCard } from "@/components/ui/MetricCard";
import { formatPct, genderLabel, stageLabel, valueChainLabel, revenueLabel } from "@/lib/labels";
import { EmptyState } from "@/components/ui/states";

export function Bar({ label, count, pct, max }: { label: string; count: number; pct: number | null; max: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-sm">
      <span className="truncate text-forest-900">{label}</span>
      <span className="tabular-nums text-ink-soft">{count} · {pct === null ? "—" : `${pct}%`}</span>
      <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-neutral-100" role="presentation"><div className="h-full rounded-full bg-leaf-600 transition-[width] duration-700" style={{ width: `${max ? (count / max) * 100 : 0}%` }} /></div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-paper-line bg-white p-5"><h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>{children}</section>;
}

export function Distribution({ title, rows, label }: { title: string; rows: Analytics["business"]["valueChain"]; label: (k: string) => string }) {
  const max = Math.max(0, ...rows.map((r) => r.count));
  return <Card title={title}>{rows.length === 0 ? <p className="text-sm text-ink-muted">No data yet</p> : <div className="space-y-3.5">{rows.map((r) => <Bar key={r.key} label={label(r.key)} count={r.count} pct={r.pct} max={max} />)}</div>}</Card>;
}

export function Overview({ a }: { a: Analytics }) {
  const d = a.demographics;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
      <MetricCard label="Total applications" value={a.total} emphasis />
      <MetricCard label="Submitted" value={a.submitted} />
      <MetricCard label="Drafts in progress" value={a.drafts} sub="Saved, not submitted" />
      <MetricCard label="Focal-state applicants" value={a.focal.focalStateCount} sub={formatPct(a.focal.focalStatePercentage)} />
      <MetricCard label="Other-state applicants" value={a.focal.otherStateCount} sub={formatPct(a.focal.otherStatePercentage)} />
      <MetricCard label="Female" value={d.female} sub={formatPct(d.femalePct)} />
      <MetricCard label="Male" value={d.male} sub={formatPct(d.malePct)} />
      <MetricCard label="With disabilities" value={d.disability} sub={formatPct(d.disabilityPct)} />
      <MetricCard label="Rural" value={d.rural} sub={formatPct(d.ruralPct)} />
      <MetricCard label="Jobs reported" value={a.business.jobsCreated} sub="Self-reported by applicants" />
    </div>
  );
}

export function Targets({ a }: { a: Analytics }) {
  return (
    <Card title="Inclusion and geography targets">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <thead><tr className="text-left text-xs text-ink-muted"><th className="pb-2 font-medium">Measure</th><th className="pb-2 text-right font-medium">Target</th><th className="pb-2 text-right font-medium">Current</th><th className="pb-2 text-right font-medium">Gap</th><th className="pb-2 pl-4 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-paper-line">
            {a.targets.map((t) => (
              <tr key={t.id}>
                <td className="py-2.5 font-medium text-forest-900">{t.label}</td>
                <td className="py-2.5 text-right tabular-nums">{t.target}%</td>
                <td className="py-2.5 text-right tabular-nums">{t.current === null ? "No data yet" : `${t.current}%`}</td>
                <td className="py-2.5 text-right tabular-nums">{t.gap === null ? "—" : t.gap === 0 ? "0" : `${t.gap} pts`}</td>
                <td className="py-2.5 pl-4">{t.met === null ? <span className="text-ink-muted">—</span> : t.met ? <span className="font-semibold text-leaf-800">✓ Target met</span> : <span className="font-semibold text-warn-fg">▲ Below target</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Percentages are shares of submitted applications. “Rural” counts applicants who live or operate in a rural area.</p>
    </Card>
  );
}

export function StateAnalytics({ a }: { a: Analytics }) {
  const f = a.focal; const max = Math.max(1, ...f.rows.map((r) => r.count));
  const otherMax = Math.max(1, ...a.otherStates.rows.map((r) => r.count));
  return (
    <div className="space-y-6">
      <section aria-labelledby="focal-h">
        <h2 id="focal-h" className="mb-3 font-display text-xl font-semibold">Focal states</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {f.rows.map((r) => (
            <div key={r.state} className="rounded-lg border border-leaf-200 bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-leaf-800">{r.state}</p>
              <p className="mt-2 font-display text-4xl font-semibold tabular-nums">{r.count}</p>
              <p className="text-sm text-ink-soft">applications · {formatPct(r.pct)}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-leaf-100" role="presentation"><div className="h-full rounded-full bg-leaf-600 transition-[width] duration-700" style={{ width: `${(r.count / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-soft">Focal states combined: <strong>{f.focalStateCount}</strong> ({formatPct(f.focalStatePercentage)})</p>
      </section>

      <section aria-labelledby="other-h">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="other-h" className="font-display text-xl font-semibold">Other states</h2>
          <p className="text-sm text-ink-soft"><strong>{a.otherStates.total}</strong> applicants ({formatPct(f.otherStatePercentage)}) from {a.otherStates.active} states</p>
        </div>
        {a.otherStates.total === 0 ? <EmptyState title="No applications from other states yet." /> : (
          <div className="overflow-x-auto rounded-lg border border-paper-line bg-white">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-paper-warm text-left text-xs text-ink-muted"><tr><th className="px-4 py-2.5 font-medium">State</th><th className="px-4 py-2.5 text-right font-medium">Applications</th><th className="px-4 py-2.5 text-right font-medium">Share</th><th className="w-1/3 px-4 py-2.5 font-medium"><span className="sr-only">Distribution</span></th></tr></thead>
              <tbody className="divide-y divide-paper-line">
                {a.otherStates.rows.filter((r) => r.count > 0).map((r) => (
                  <tr key={r.state}><td className="px-4 py-2.5 font-medium text-forest-900">{r.state}</td><td className="px-4 py-2.5 text-right tabular-nums">{r.count}</td><td className="px-4 py-2.5 text-right tabular-nums">{formatPct(r.pct)}</td>
                    <td className="px-4 py-2.5"><div className="h-1.5 overflow-hidden rounded-full bg-neutral-100" role="presentation"><div className="h-full rounded-full bg-leaf-500" style={{ width: `${(r.count / otherMax) * 100}%` }} /></div></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function Demographics({ a }: { a: Analytics }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Distribution title="Value chain" rows={a.business.valueChain} label={valueChainLabel} />
      <Distribution title="Business stage" rows={a.business.stage} label={stageLabel} />
      <Distribution title="Age group" rows={a.demographics.age} label={(k) => k} />
      <Distribution title="Annual revenue" rows={a.business.revenue} label={revenueLabel} />
    </div>
  );
}
export { genderLabel };
