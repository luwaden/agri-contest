import type { ElementType, ReactNode } from "react";
import { CountUp } from "@/components/ui/motion";

/**
 * The four card tones from the design system.
 *  yellow  → dates, calls to action, key figures        (text: night)
 *  green   → benefits, supporting information           (text: night)
 *  blue    → highlights, partners, secondary blocks     (text: white)
 *  primary → major sections and anchors                 (text: white)
 */
export type CardTone = "yellow" | "green" | "blue" | "primary" | "light";

const TONES: Record<CardTone, { box: string; eyebrow: string; muted: string }> = {
  yellow: { box: "bg-sun text-night", eyebrow: "text-night/70", muted: "text-night/80" },
  green: { box: "bg-lime text-night", eyebrow: "text-night/70", muted: "text-night/80" },
  blue: { box: "bg-azure text-white", eyebrow: "text-white/80", muted: "text-white/90" },
  primary: { box: "bg-primary text-white", eyebrow: "text-lime", muted: "text-white/85" },
  /** White / warm-paper card: always dark text. Never repaint a dark tone light with className, use this. */
  light: { box: "bg-paper-warm text-ink border border-paper-line", eyebrow: "text-primary", muted: "text-ink-soft" },
};

interface CardProps { eyebrow?: string; title?: ReactNode; children?: ReactNode; className?: string; as?: ElementType; interactive?: boolean }

export function InfoCard({ tone, eyebrow, title, children, className = "", as: Tag = "div", interactive = true }: CardProps & { tone: CardTone }) {
  const t = TONES[tone] ?? TONES.light; // an unknown tone falls back to the white card instead of crashing the page
  return (
    <Tag className={`rounded-card p-5 shadow-card sm:p-6 ${t.box} ${interactive ? "transition duration-300 hover:-translate-y-1 hover:shadow-lift" : ""} ${className}`}>
      {eyebrow && <p className={`text-xs font-bold uppercase tracking-[0.14em] ${t.eyebrow}`}>{eyebrow}</p>}
      {title && <h3 className={`mt-2 font-display text-lg leading-snug text-inherit sm:text-xl ${eyebrow ? "" : "mt-0"}`}>{title}</h3>}
      {children && <div className={`${title || eyebrow ? "mt-3" : ""} text-sm leading-relaxed ${t.muted}`}>{children}</div>}
    </Tag>
  );
}
export const YellowCard = (p: CardProps) => <InfoCard tone="yellow" {...p} />;
export const GreenCard = (p: CardProps) => <InfoCard tone="green" {...p} />;
export const BlueCard = (p: CardProps) => <InfoCard tone="blue" {...p} />;
export const PrimaryCard = (p: CardProps) => <InfoCard tone="primary" {...p} />;

/** Big number + caption. Counts up once when scrolled into view. */
export function ProgrammeStat({ tone, value, suffix = "", label }: { tone: CardTone; value: number; suffix?: string; label: string }) {
  const t = TONES[tone] ?? TONES.light; // an unknown tone falls back to the white card instead of crashing the page
  return (
    <div className={`rounded-card p-5 shadow-card sm:p-7 ${t.box}`}>
      <p className="font-display text-4xl text-inherit sm:text-5xl"><CountUp to={value} suffix={suffix} /></p>
      <p className={`mt-1.5 text-sm font-medium ${t.muted}`}>{label}</p>
    </div>
  );
}

/** Rounded date tile used in the hero (mirrors the flyers' Date / Sessions row). */
export function DateCard({ tone, label, day, month, note }: { tone: CardTone; label: string; day: string; month: string; note?: string }) {
  const t = TONES[tone] ?? TONES.light; // an unknown tone falls back to the white card instead of crashing the page
  return (
    <div className={`rounded-card px-5 py-4 ${t.box}`}>
      <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${t.eyebrow}`}>{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5"><span className="font-display text-3xl text-inherit sm:text-4xl">{day}</span><span className="text-sm font-bold sm:text-base">{month}</span></p>
      {note && <p className={`mt-0.5 text-xs ${t.muted}`}>{note}</p>}
    </div>
  );
}

/** Bullet list in the flyer style: bright yellow dots on dark green. */
export function BulletList({ items, tone = "onDark" }: { items: string[]; tone?: "onDark" | "onLight" }) {
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i} className="flex gap-3 text-sm leading-snug sm:text-[15px]">
          <span aria-hidden="true" className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${tone === "onDark" ? "bg-sun" : "bg-primary"}`} />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}
