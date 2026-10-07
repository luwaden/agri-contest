type Tone = "plain" | "yellow" | "green" | "blue" | "primary";
const T: Record<Tone, string> = { plain: "border border-paper-line bg-white text-ink", yellow: "bg-sun text-night", green: "bg-lime text-night", blue: "bg-azure text-white", primary: "bg-primary text-white" };
export function MetricCard({ label, value, sub, tone = "plain", emphasis = false }: { label: string; value: string | number; sub?: string; tone?: Tone; emphasis?: boolean }) {
  const t = emphasis && tone === "plain" ? "yellow" : tone;
  return (
    <div className={`rounded-tile p-4 sm:p-5 ${T[t]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1.5 font-display text-3xl tabular-nums text-inherit">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-80">{sub}</p>}
    </div>
  );
}
