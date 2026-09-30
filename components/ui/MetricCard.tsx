export function MetricCard({ label, value, sub, emphasis = false }: { label: string; value: string | number; sub?: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 sm:p-5 ${emphasis ? "border-leaf-300 bg-leaf-50" : "border-paper-line bg-white"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1.5 font-display text-3xl font-semibold text-forest-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}
