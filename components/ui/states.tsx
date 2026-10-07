"use client";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function LoadingState({ label = "Loading", rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center">
      <p className="text-base font-semibold text-forest-900">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger-line bg-danger-bg px-6 py-8 text-center">
      <p className="text-sm font-medium text-danger-fg">{message}</p>
      {onRetry && <div className="mt-4"><Button variant="secondary" onClick={onRetry}>Try again</Button></div>}
    </div>
  );
}
