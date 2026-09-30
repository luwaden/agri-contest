const STEPS = [{ n: "01", label: "Profile" }, { n: "02", label: "Business" }, { n: "03", label: "Impact & Submission" }];

export function ProgressStepper({ current }: { current: number }) {
  return (
    <nav aria-label="Application progress" className="mb-8">
      <p className="mb-3 text-sm font-medium text-ink-soft sm:hidden">
        Step {Math.min(current + 1, 3)} of 3 · <span className="text-forest-900">{STEPS[Math.min(current, 2)].label}</span>
      </p>
      <ol className="flex items-start gap-2">
        {STEPS.map((s, i) => {
          const done = i < current; const active = i === current;
          return (
            <li key={s.n} className="flex-1" aria-current={active ? "step" : undefined}>
              <div className={`h-1 rounded-full transition-colors duration-500 ${done || active ? "bg-leaf-600" : "bg-neutral-200"}`} />
              <div className="mt-2.5 hidden items-center gap-2 sm:flex">
                <span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${done ? "bg-leaf-700 text-white" : active ? "border-2 border-leaf-700 text-leaf-800" : "border border-neutral-300 text-ink-muted"}`}>
                  {done ? <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6.5l2.5 2.5L10 3.5" /></svg> : s.n}
                </span>
                <span className={`text-sm ${active ? "font-semibold text-forest-900" : "text-ink-soft"}`}>{s.label}</span>
                <span className="sr-only">{done ? "(completed)" : active ? "(current step)" : "(not started)"}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
