"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface Step { id: string; label: string; status: "pass" | "warn" | "fail"; detail: string; fix?: string; ms: number }
const ICON = { pass: ["✓", "bg-lime text-night"], warn: ["!", "bg-sun text-night"], fail: ["✕", "bg-danger-fg text-white"] } as const;

export function SystemCheck() {
  const [res, setRes] = useState<{ ok: boolean; version: string; commit: string; steps: Step[] } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function run() {
    setBusy(true); setErr(""); setRes(null);
    try { const r = await fetch("/api/admin/system-check", { method: "POST" }); const d = await r.json(); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); setRes(d); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-5">
      <Button type="button" onClick={run} disabled={busy} className="!rounded-full !px-8 !py-3.5">{busy ? "Checking… (up to 20 s)" : "Run system check"}</Button>
      {err && <p role="alert" className="rounded-card border border-danger-line bg-danger-bg p-4 text-sm font-medium text-danger-fg">{err}</p>}
      {res && (
        <div aria-live="polite" className="space-y-3">
          <p className={`rounded-card p-4 font-display text-xl ${res.ok ? "bg-lime text-night" : "bg-danger-bg text-danger-fg"}`}>{res.ok ? "Everything a submission needs is working." : "Something needs fixing: see the red items."} <span className="block text-xs font-normal opacity-80">Version {res.version} · build {res.commit}</span></p>
          <ol className="space-y-2">{res.steps.map((s) => (
            <li key={s.id} className="flex gap-3 rounded-card border border-paper-line bg-white p-4">
              <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${ICON[s.status][1]}`}>{ICON[s.status][0]}</span>
              <div className="min-w-0"><p className="font-semibold text-primary">{s.label} <span className="sr-only">: {s.status}</span><span className="ml-2 text-xs font-normal text-ink-muted">{s.ms} ms</span></p>
                <p className="break-words text-sm text-ink-soft">{s.detail}</p>{s.fix && <p className="mt-1 text-sm font-semibold text-danger-fg">Fix: {s.fix}</p>}</div>
            </li>))}</ol>
        </div>
      )}
    </div>
  );
}
