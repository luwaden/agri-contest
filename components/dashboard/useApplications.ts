"use client";
import { useCallback, useEffect, useState } from "react";
import type { Analytics } from "@/lib/analytics/compute";
import type { ApplicationFilters } from "@/lib/analytics/filters";

export interface TableRow {
  applicationId: string; applicant: string; business: string; state: string; locationGroup: string; valueChain: string;
  gender: string; status: string; submittedAt: string | null; score: number | null;
}
interface Payload { demo: boolean; count: number; applications: TableRow[]; analytics: Analytics }

/** Loads rows + analytics from the API for the given filters. */
export function useApplications(filters: ApplicationFilters) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const key = JSON.stringify(filters);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(false);
    try {
      const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
      const r = await fetch(`/api/admin/applications?${qs}`, { signal, cache: "no-store" });
      if (r.status === 401) { window.location.href = "/admin/login"; return; }
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch (e) { if ((e as Error).name !== "AbortError") setError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { const c = new AbortController(); const t = setTimeout(() => load(c.signal), 150); return () => { clearTimeout(t); c.abort(); }; }, [load]);
  return { data, loading, error, reload: () => load() };
}
