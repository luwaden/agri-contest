import { APPLICATION_WINDOW_DEFAULTS } from "@/config/programme";

export type WindowStatus = "OPENING_SOON" | "OPEN" | "CLOSED";

/** The ONLY place the deadline logic lives. Used by landing page, apply page and API routes. */
export function getWindow() {
  const open = new Date(process.env.APPLICATION_OPEN_DATE || APPLICATION_WINDOW_DEFAULTS.open);
  const close = new Date(process.env.APPLICATION_CLOSE_DATE || APPLICATION_WINDOW_DEFAULTS.close);
  if (Number.isNaN(open.getTime()) || Number.isNaN(close.getTime())) {
    throw new Error("APPLICATION_OPEN_DATE / APPLICATION_CLOSE_DATE must be ISO 8601 dates with a timezone offset.");
  }
  return { open, close };
}

export function getWindowStatus(now: Date = new Date()): WindowStatus {
  const { open, close } = getWindow();
  if (now < open) return "OPENING_SOON";
  if (now > close) return "CLOSED";
  return "OPEN";
}

const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(d);
const fmtShort = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(d);

export function windowSummary(now: Date = new Date()) {
  const { open, close } = getWindow();
  const status = getWindowStatus(now);
  const days = Math.max(0, Math.ceil(((status === "OPENING_SOON" ? open : close).getTime() - now.getTime()) / 86_400_000));
  return {
    status,
    openLabel: fmt(open), closeLabel: fmt(close),
    range: `Applications open ${fmtShort(open)} and close ${fmt(close)}.`,
    cta: status === "OPEN" ? "Apply Now" : status === "OPENING_SOON" ? `Applications Open ${fmtShort(open)}` : "Applications Closed",
    countdown: status === "OPENING_SOON" ? `Opens in ${days} day${days === 1 ? "" : "s"}`
      : status === "OPEN" ? (days <= 1 ? "Closes today or tomorrow" : `${days} days left`) : "The application window has ended",
  };
}
