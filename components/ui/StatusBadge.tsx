import { STATUSES } from "@/config/programme";

const tone: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-ink-soft border-neutral-300",
  SUBMITTED: "bg-leaf-50 text-leaf-800 border-leaf-200",
  UNDER_REVIEW: "bg-warn-bg text-warn-fg border-warn-line",
  SHORTLISTED: "bg-leaf-100 text-leaf-900 border-leaf-300",
  NOT_SELECTED: "bg-neutral-100 text-ink-soft border-neutral-300",
  FINALIST: "bg-leaf-700 text-white border-leaf-700",
  WINNER: "bg-forest-900 text-white border-forest-900",
};

/** Always shows the text label, so status never depends on color alone. */
export function StatusBadge({ status }: { status: string }) {
  const label = STATUSES.find((s) => s.value === status)?.label ?? status;
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone[status] ?? tone.DRAFT}`}>{label}</span>;
}
