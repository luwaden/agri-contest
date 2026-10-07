"use client";
import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/** Fades content up when it scrolls into view. Content is fully visible without JS or with reduced motion. */
export function Reveal({ children, delay = 0, as: Tag = "div", className = "" }: { children: ReactNode; delay?: number; as?: ElementType; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || el.getBoundingClientRect().top < window.innerHeight * 0.9) { el.classList.add("in"); return; } // visible now: no hide/flash
    el.classList.add("reveal-init");
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { requestAnimationFrame(() => el.classList.add("in")); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={className} style={{ ["--d" as string]: `${delay}ms` }}>{children}</Tag>;
}

/** Counts up once when scrolled into view. Server renders the final value. */
export function CountUp({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(to);
  useEffect(() => {
    const el = ref.current; if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / duration); setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
      setN(0); requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el); return () => io.disconnect();
  }, [to, duration]);
  return <span ref={ref} className="tabular-nums">{n}{suffix}</span>;
}
