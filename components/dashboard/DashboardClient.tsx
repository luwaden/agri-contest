"use client";
import { useState } from "react";
import type { ApplicationFilters } from "@/lib/analytics/filters";
import { FilterBar } from "./FilterBar";
import { Demographics, Overview, StateAnalytics, Targets } from "./Panels";
import { useApplications } from "./useApplications";
import { Skeleton } from "@/components/ui/states";
import { EmptyState, ErrorState } from "@/components/ui/states";
import Link from "next/link";

export function DashboardClient() {
  const [filters, setFilters] = useState<ApplicationFilters>({});
  const { data, loading, error, reload } = useApplications(filters);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl font-semibold">Dashboard</h1><p className="text-sm text-ink-soft">Live from the application data store. Filters apply to every figure below.</p></div>
        <Link href="/admin/applications" className="text-sm font-semibold text-leaf-800 hover:underline">View all applications →</Link>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      {error ? <ErrorState message="We couldn't load the analytics right now. Please try again." onRetry={reload} />
        : !data ? <div className="space-y-6" role="status" aria-label="Loading analytics"><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="h-64" /></div>
        : data.analytics.total === 0 && Object.values(filters).every((v) => !v) ? <EmptyState title="No applications yet." body="Submitted applications will appear here automatically." />
        : (
          <div className={`space-y-8 transition-opacity duration-300 ${loading ? "opacity-60" : "opacity-100"}`} aria-busy={loading}>
            {data.analytics.total === 0 && <EmptyState title="No applications match these filters." />}
            <Overview a={data.analytics} />
            <StateAnalytics a={data.analytics} />
            <Targets a={data.analytics} />
            <Demographics a={data.analytics} />
          </div>
        )}
    </div>
  );
}
