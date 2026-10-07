"use client";
import type { ApplicationFilters } from "@/lib/analytics/filters";
/** Downloads the currently filtered applications as CSV (server checks permission and logs the export). */
export function ExportButton({ filters }: { filters: ApplicationFilters }) {
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  return <a href={`/api/admin/export${qs ? `?${qs}` : ""}`} className="inline-flex items-center rounded-full border-2 border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-white" download>Export CSV</a>;
}
