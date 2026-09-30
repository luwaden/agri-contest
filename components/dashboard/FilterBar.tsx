"use client";
import { BUSINESS_STAGES, DISABILITY_OPTIONS, GENDERS, LANGUAGES, NIGERIAN_STATES, SETTINGS, STATUSES, VALUE_CHAINS } from "@/config/programme";
import type { ApplicationFilters } from "@/lib/analytics/filters";

type Opts = ReadonlyArray<string | { value: string; label: string }>;
function Sel({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string) => void; options: Opts }) {
  return (
    <label className="block text-xs font-medium text-ink-soft">{label}
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm text-ink focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-600/25">
        <option value="">All</option>
        {options.map((o) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label; return <option key={v} value={v}>{l}</option>; })}
      </select>
    </label>
  );
}

export function FilterBar({ filters, onChange, showSearch = false }: { filters: ApplicationFilters; onChange: (f: ApplicationFilters) => void; showSearch?: boolean }) {
  const set = (k: keyof ApplicationFilters) => (v: string) => onChange({ ...filters, [k]: v || undefined });
  const active = Object.values(filters).filter(Boolean).length;
  const input = "mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm focus:border-leaf-600 focus:outline-none focus:ring-2 focus:ring-leaf-600/25";
  return (
    <details className="group rounded-lg border border-paper-line bg-white" open={active > 0 || undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-forest-900 [&::-webkit-details-marker]:hidden">
        <span>Filters{active > 0 && <span className="ml-2 rounded-full bg-leaf-700 px-2 py-0.5 text-xs text-white">{active} active</span>}</span>
        <span aria-hidden="true" className="text-leaf-700 transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="grid gap-3 border-t border-paper-line p-4 sm:grid-cols-2 lg:grid-cols-4">
        {showSearch && <label className="block text-xs font-medium text-ink-soft sm:col-span-2">Search<input type="search" value={filters.q ?? ""} onChange={(e) => set("q")(e.target.value)} placeholder="Reference, name, business or email" className={input} /></label>}
        <Sel label="State" value={filters.state} onChange={set("state")} options={NIGERIAN_STATES} />
        <label className="block text-xs font-medium text-ink-soft">LGA<input value={filters.lga ?? ""} onChange={(e) => set("lga")(e.target.value)} className={input} /></label>
        <Sel label="Location group" value={filters.locationGroup} onChange={set("locationGroup")} options={[{ value: "FOCAL_STATES", label: "Focal states" }, { value: "OTHER_STATES", label: "Other states" }]} />
        <Sel label="Gender" value={filters.gender} onChange={set("gender")} options={GENDERS} />
        <Sel label="Disability" value={filters.disability} onChange={set("disability")} options={DISABILITY_OPTIONS} />
        <Sel label="Rural / urban" value={filters.setting} onChange={set("setting")} options={SETTINGS} />
        <Sel label="Value chain" value={filters.valueChain} onChange={set("valueChain")} options={VALUE_CHAINS} />
        <Sel label="Business stage" value={filters.stage} onChange={set("stage")} options={BUSINESS_STAGES} />
        <Sel label="Status" value={filters.status} onChange={set("status")} options={STATUSES.filter((s) => s.value !== "DRAFT")} />
        <Sel label="Language" value={filters.language} onChange={set("language")} options={LANGUAGES} />
        <label className="block text-xs font-medium text-ink-soft">Submitted from<input type="date" value={filters.from ?? ""} onChange={(e) => set("from")(e.target.value)} className={input} /></label>
        <label className="block text-xs font-medium text-ink-soft">Submitted to<input type="date" value={filters.to ?? ""} onChange={(e) => set("to")(e.target.value)} className={input} /></label>
        {active > 0 && <div className="flex items-end"><button type="button" onClick={() => onChange({})} className="rounded-md px-3 py-2 text-sm font-semibold text-leaf-800 hover:bg-leaf-50">Clear all filters</button></div>}
      </div>
    </details>
  );
}
