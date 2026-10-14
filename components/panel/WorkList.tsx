"use client";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { WorkItem } from "@/lib/services/reviewService";
import { formatDate, settingLabel, stageLabel, valueChainLabel } from "@/lib/labels";

const STATUS: Record<string, { label: string; cls: string }> = {
  ASSIGNED: { label: "To score", cls: "bg-sun text-night" },
  IN_PROGRESS: { label: "In progress", cls: "bg-azure text-white" },
  SUBMITTED: { label: "Submitted", cls: "bg-lime text-night" },
  CONFLICT: { label: "Conflict declared", cls: "bg-paper-line text-ink-soft" },
};
const SORTS = { assigned: "Oldest assigned first", ref: "Reference", name: "Business name A–Z", scoreHigh: "My score, high to low", scoreLow: "My score, low to high" } as const;
type Sort = keyof typeof SORTS;

/** The panel member's own applications with filters. Filters live in the address bar, so they survive opening a score sheet and coming back. */
export function WorkList({ items, base }: { items: WorkItem[]; base: string }) {
  const params = useSearchParams(); const router = useRouter(); const path = usePathname();
  const f = { q: params.get("q") ?? "", status: params.get("status") ?? "", chain: params.get("chain") ?? "", state: params.get("state") ?? "", stage: params.get("stage") ?? "", setting: params.get("setting") ?? "", sort: (params.get("sort") as Sort) || "assigned" };
  const set = (k: string, v: string) => { const p = new URLSearchParams(params.toString()); if (v) p.set(k, v); else p.delete(k); router.replace(`${path}${p.size ? `?${p}` : ""}`, { scroll: false }); };
  const clear = () => router.replace(path, { scroll: false });
  const active = ["q", "status", "chain", "state", "stage", "setting"].filter((k) => (f as Record<string, string>)[k]).length;

  const uniq = (pick: (w: WorkItem) => string) => [...new Set(items.map(pick).filter(Boolean))].sort();
  const chains = uniq((w) => w.app.valueChain), states = uniq((w) => w.app.state), stages = uniq((w) => w.app.stage), settings = uniq((w) => w.app.setting);
  const statusCount = (s: string) => items.filter((w) => w.review.status === s).length;

  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const list = items.filter((w) => (!f.status || w.review.status === f.status) && (!f.chain || w.app.valueChain === f.chain) && (!f.state || w.app.state === f.state)
      && (!f.stage || w.app.stage === f.stage) && (!f.setting || w.app.setting === f.setting)
      && (!q || w.app.applicationId.toLowerCase().includes(q) || w.app.businessName.toLowerCase().includes(q)));
    const score = (w: WorkItem) => w.review.total ?? -1;
    return [...list].sort((a, b) => f.sort === "ref" ? a.app.applicationId.localeCompare(b.app.applicationId)
      : f.sort === "name" ? a.app.businessName.localeCompare(b.app.businessName)
      : f.sort === "scoreHigh" ? score(b) - score(a) : f.sort === "scoreLow" ? (score(a) === -1 ? 1 : score(b) === -1 ? -1 : score(a) - score(b))
      : a.review.assignedAt.localeCompare(b.review.assignedAt) || a.app.applicationId.localeCompare(b.app.applicationId));
  }, [items, f.q, f.status, f.chain, f.state, f.stage, f.setting, f.sort]);

  const select = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {[["", `All (${items.length})`], ["ASSIGNED", `To score (${statusCount("ASSIGNED")})`], ["IN_PROGRESS", `In progress (${statusCount("IN_PROGRESS")})`], ["SUBMITTED", `Submitted (${statusCount("SUBMITTED")})`], ["CONFLICT", `Conflicts (${statusCount("CONFLICT")})`]].map(([v, l]) => (
          <button key={v} type="button" aria-pressed={f.status === v} onClick={() => set("status", v)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${f.status === v ? "border-primary bg-primary text-white" : "border-paper-line bg-white text-primary hover:border-primary"}`}>{l}</button>
        ))}
      </div>

      {/* Other filters */}
      <div className="grid gap-3 rounded-card border border-paper-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs font-semibold text-ink-muted lg:col-span-2">Search reference or business
          <input type="search" value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="e.g. AGRA-2026 or Farm" className={`${select} mt-1 font-normal`} /></label>
        <label className="text-xs font-semibold text-ink-muted">Value chain
          <select value={f.chain} onChange={(e) => set("chain", e.target.value)} className={`${select} mt-1 font-normal`}><option value="">All</option>{chains.map((v) => <option key={v} value={v}>{valueChainLabel(v)}</option>)}</select></label>
        <label className="text-xs font-semibold text-ink-muted">State
          <select value={f.state} onChange={(e) => set("state", e.target.value)} className={`${select} mt-1 font-normal`}><option value="">All</option>{states.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label className="text-xs font-semibold text-ink-muted">Business stage
          <select value={f.stage} onChange={(e) => set("stage", e.target.value)} className={`${select} mt-1 font-normal`}><option value="">All</option>{stages.map((v) => <option key={v} value={v}>{stageLabel(v)}</option>)}</select></label>
        <label className="text-xs font-semibold text-ink-muted">Rural or urban
          <select value={f.setting} onChange={(e) => set("setting", e.target.value)} className={`${select} mt-1 font-normal`}><option value="">All</option>{settings.map((v) => <option key={v} value={v}>{settingLabel(v)}</option>)}</select></label>
        <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2 lg:col-span-6">
          <label className="text-xs font-semibold text-ink-muted">Sort by
            <select value={f.sort} onChange={(e) => set("sort", e.target.value === "assigned" ? "" : e.target.value)} className={`${select} mt-1 w-56 font-normal`}>{Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <p className="text-sm text-ink-soft" aria-live="polite">Showing <strong className="tabular-nums text-primary">{shown.length}</strong> of {items.length}
            {active > 0 && <button type="button" onClick={clear} className="ml-3 font-semibold text-azure underline">Clear {active} filter{active > 1 ? "s" : ""}</button>}</p>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-card border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-ink-soft">No applications match these filters. <button type="button" onClick={clear} className="font-semibold text-azure underline">Clear filters</button></div>
      ) : (
        <ul className="grid gap-3">
          {shown.map((w) => {
            const s = STATUS[w.review.status] ?? STATUS.ASSIGNED;
            const action = w.review.status === "ASSIGNED" ? "Start scoring" : w.review.status === "IN_PROGRESS" ? "Continue" : "View";
            return (
              <li key={w.review.reviewId}>
                <Link href={`${base}/${w.app.applicationId}`} className="group grid items-center gap-3 rounded-tile border border-paper-line bg-white px-5 py-4 transition-shadow hover:shadow-card sm:grid-cols-[1fr_auto_auto]">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink-muted">{w.app.applicationId}</p>
                    <p className="truncate font-display text-lg font-extrabold text-primary group-hover:underline">{w.app.businessName || "(no business name)"}</p>
                    <p className="text-sm text-ink-soft">{[valueChainLabel(w.app.valueChain), w.app.state, stageLabel(w.app.stage), settingLabel(w.app.setting)].filter(Boolean).join(" · ")}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">Assigned {formatDate(w.review.assignedAt)}{w.review.submittedAt ? ` · submitted ${formatDate(w.review.submittedAt)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>{s.label}</span>
                    {w.review.total != null && <span className="font-display text-2xl font-extrabold tabular-nums text-primary" title="Your weighted total out of 100">{w.review.total}<span className="text-sm font-semibold text-ink-muted">/100</span></span>}
                  </div>
                  <span className="justify-self-start rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white sm:justify-self-end">{action} →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
