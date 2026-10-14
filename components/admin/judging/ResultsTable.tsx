"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ResultRow } from "@/lib/judging";
import { SPREAD_ALERT } from "@/lib/judging";
import { csvCell } from "@/lib/csv";
import { valueChainLabel } from "@/lib/labels";

const FLAG: Record<string, { label: string; cls: string; title: string }> = {
  TIE: { label: "Tie", cls: "bg-azure text-white", title: "Same average and same tie-break scores as a neighbour: the moderation panel decides." },
  SPREAD: { label: "Scores far apart", cls: "bg-warn-bg text-warn-fg", title: `Totals differ by ${SPREAD_ALERT} points or more: worth a second look.` },
  WAITING: { label: "Waiting", cls: "bg-paper-line text-ink-soft", title: "Not every assigned person has submitted yet." },
  NEEDS_PANEL: { label: "Nobody assigned", cls: "bg-danger-bg text-danger-fg", title: "Everyone declared a conflict or was withdrawn." },
};

export function ResultsTable({ rows, criteria, round }: { rows: ResultRow[]; criteria: Array<{ id: string; name: string }>; round: string }) {
  const [only, setOnly] = useState<"" | "complete" | "flagged">("");
  const shown = useMemo(() => rows.filter((r) => !only || (only === "complete" ? r.submitted > 0 && !r.flags.includes("WAITING") : r.flags.some((f) => f !== "WAITING"))), [rows, only]);
  if (!rows.length) return <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-5 py-6 text-sm text-ink-soft">No scores yet. Results appear here as score sheets are submitted.</p>;

  function download() {
    const head = ["Rank", "Reference", "Business", "Value chain", "State", "Status", "Submitted", "Assigned", "Conflicts", "Average /100", ...criteria.map((c) => `${c.name} avg /10`), "Lowest", "Highest", "Flags"];
    const body = shown.map((r) => [r.rank ?? "", r.applicationId, r.businessName, valueChainLabel(r.valueChain), r.state, r.status, r.submitted, r.assigned, r.conflicts, r.average ?? "", ...criteria.map((c) => r.criterionAverages[c.id] ?? ""), r.min ?? "", r.max ?? "", r.flags.map((f) => FLAG[f]?.label ?? f).join("; ")]);
    const blob = new Blob(["﻿" + [head, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `results-${round}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="flex gap-2 text-sm">
          {[["", `All (${rows.length})`], ["complete", "Fully scored"], ["flagged", "Needs attention"]].map(([v, l]) => <button key={v} type="button" aria-pressed={only === v} onClick={() => setOnly(v as typeof only)} className={`rounded-full border px-3 py-1 font-semibold ${only === v ? "border-primary bg-primary text-white" : "border-paper-line bg-white text-primary"}`}>{l}</button>)}
        </div>
        <button type="button" onClick={download} className="rounded-full border border-primary bg-white px-4 py-1.5 text-sm font-semibold text-primary">Download CSV</button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-paper-line bg-white">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-paper-warm text-left text-xs text-ink-muted"><tr>
            <th className="px-3 py-3">Rank</th><th className="px-3 py-3">Application</th><th className="px-3 py-3">Scored</th><th className="px-3 py-3">Average</th>
            {criteria.map((c) => <th key={c.id} className="px-2 py-3" title={c.name}>{c.name.split(" ")[0]}</th>)}<th className="px-3 py-3">Range</th><th className="px-3 py-3">Flags</th>
          </tr></thead>
          <tbody className="divide-y divide-paper-line">{shown.map((r) => (
            <tr key={r.applicationId} className="align-top">
              <td className="px-3 py-2.5 font-display text-lg font-extrabold tabular-nums">{r.rank ?? "–"}</td>
              <td className="px-3 py-2.5"><Link href={`/admin/applications/${r.applicationId}`} className="font-semibold text-primary hover:underline">{r.businessName || r.applicationId}</Link><p className="font-mono text-xs text-ink-muted">{r.applicationId}</p><p className="text-xs text-ink-muted">{valueChainLabel(r.valueChain)} · {r.state}</p></td>
              <td className="px-3 py-2.5 tabular-nums">{r.submitted}/{r.assigned}{r.conflicts ? <span className="block text-xs text-warn-fg">{r.conflicts} conflict{r.conflicts > 1 ? "s" : ""}</span> : null}</td>
              <td className="px-3 py-2.5 font-display text-lg font-extrabold tabular-nums">{r.average ?? "–"}</td>
              {criteria.map((c) => <td key={c.id} className="px-2 py-2.5 tabular-nums text-ink-soft">{r.criterionAverages[c.id] ?? "–"}</td>)}
              <td className="px-3 py-2.5 tabular-nums text-ink-soft">{r.min != null ? `${r.min}–${r.max}` : "–"}</td>
              <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{r.flags.map((f) => <span key={f} title={FLAG[f]?.title} className={`rounded-full px-2 py-0.5 text-xs font-bold ${FLAG[f]?.cls}`}>{FLAG[f]?.label ?? f}</span>)}</div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
