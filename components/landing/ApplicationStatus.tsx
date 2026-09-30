import { windowSummary } from "@/lib/window";

const COPY = { OPENING_SOON: "Opening soon", OPEN: "Open", CLOSED: "Closed" } as const;

/** Driven entirely by the configured dates. The text label carries the meaning; the marker shape is secondary. */
export function ApplicationStatus({ inverse = false }: { inverse?: boolean }) {
  const w = windowSummary();
  const marker = w.status === "OPEN" ? "●" : w.status === "OPENING_SOON" ? "◐" : "○";
  return (
    <div className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3.5 py-2 text-sm ${inverse ? "border-white/25 text-white" : "border-paper-line text-forest-900"}`}>
      <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${inverse ? "text-leaf-200" : "text-ink-muted"}`}>Application status</span>
      <span className="font-semibold"><span aria-hidden="true" className="mr-1.5">{marker}</span>{COPY[w.status]}</span>
      <span className={inverse ? "text-white/70" : "text-ink-muted"}>{w.countdown}</span>
    </div>
  );
}
