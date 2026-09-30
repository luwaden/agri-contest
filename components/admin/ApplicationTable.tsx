"use client";
import { useState } from "react";
import Link from "next/link";
import type { ApplicationFilters } from "@/lib/analytics/filters";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { useApplications } from "@/components/dashboard/useApplications";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { StatusSelect } from "./StatusSelect";
import { formatDate, genderLabel, groupLabel, valueChainLabel } from "@/lib/labels";

export function ApplicationTable({ canChangeStatus }: { canChangeStatus: boolean }) {
  const [filters, setFilters] = useState<ApplicationFilters>({});
  const { data, loading, error, reload } = useApplications(filters);
  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-3xl font-semibold">Applications</h1>
        <p className="text-sm text-ink-soft" aria-live="polite">{data ? `${data.count} ${data.count === 1 ? "application" : "applications"}` : "Loading…"}</p></div>
      <FilterBar filters={filters} onChange={setFilters} showSearch />
      {error ? <ErrorState message="We couldn't load the applications right now. Please try again." onRetry={reload} />
        : !data ? <LoadingState label="Loading applications" rows={6} />
        : data.count === 0 ? <EmptyState title={Object.values(filters).some(Boolean) ? "No applications match these filters." : "No applications yet."} body={Object.values(filters).some(Boolean) ? "Try removing a filter." : "Submitted applications will appear here automatically."} />
        : (
          <div className={`overflow-x-auto rounded-lg border border-paper-line bg-white transition-opacity ${loading ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-paper-warm text-left text-xs text-ink-muted">
                <tr>{["Application ID", "Applicant", "Business", "State", "Location group", "Value chain", "Gender", "Status", "Submitted", "Score", "Actions"].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-3 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-paper-line">
                {data.applications.map((a) => (
                  <tr key={a.applicationId} className="align-top hover:bg-paper-warm/60">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{a.applicationId}</td>
                    <td className="px-3 py-3 font-medium text-forest-900">{a.applicant}</td>
                    <td className="px-3 py-3">{a.business}</td>
                    <td className="px-3 py-3">{a.state}</td>
                    <td className="whitespace-nowrap px-3 py-3">{groupLabel(a.locationGroup)}</td>
                    <td className="px-3 py-3">{valueChainLabel(a.valueChain)}</td>
                    <td className="px-3 py-3">{genderLabel(a.gender)}</td>
                    <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                    <td className="whitespace-nowrap px-3 py-3">{formatDate(a.submittedAt)}</td>
                    <td className="px-3 py-3 text-ink-muted">{a.score ?? "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-3">
                        <Link href={`/admin/applications/${a.applicationId}`} className="font-semibold text-leaf-800 hover:underline">View<span className="sr-only"> {a.applicationId}</span></Link>
                        {canChangeStatus && !data.demo && <StatusSelect id={a.applicationId} status={a.status} onChanged={() => reload()} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
