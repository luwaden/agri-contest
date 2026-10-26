"use client";
import { useState } from "react";
import { FEATURES, FEATURE_KEYS, type FeatureKey, type FeatureState } from "@/config/features";

type Snap = { state: FeatureState; changes: Partial<Record<FeatureKey, { updatedAt: string; updatedBy: string }>>; source: string; problem: string | null };
const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };

/** One row per switch, grouped. Each change is saved at once and confirmed; turning something off asks first. */
export function FeatureSwitches({ initial }: { initial: Snap }) {
  const [snap, setSnap] = useState(initial);
  const [saving, setSaving] = useState<FeatureKey | null>(null);
  const [note, setNote] = useState<{ key: FeatureKey; tone: "ok" | "err"; text: string } | null>(null);
  const groups = [...new Set(FEATURE_KEYS.map((k) => FEATURES[k].group))];

  async function toggle(k: FeatureKey) {
    const on = !snap.state[k];
    if (!on && !window.confirm(`Turn off "${FEATURES[k].label}"?\n\n${FEATURES[k].off}`)) return;
    setSaving(k); setNote(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k, on }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setNote({ key: k, tone: "err", text: d.message ?? `Not saved (the server answered ${res.status}).` }); return; }
      setSnap(d); setNote({ key: k, tone: "ok", text: `${on ? "Turned on" : "Turned off"}. Takes effect everywhere within about 20 seconds.` });
    } catch { setNote({ key: k, tone: "err", text: "Not saved: could not reach the server." }); }
    finally { setSaving(null); }
  }

  return (
    <div className="space-y-6">
      {snap.problem && <p role="alert" className="rounded-md bg-warn-bg px-4 py-3 text-sm text-warn-fg">{snap.problem} {snap.source === "defaults" ? "The default settings are in use." : "The last known settings are in use."}</p>}
      {groups.map((g) => (
        <section key={g} aria-labelledby={`g-${g}`} className="rounded-lg border border-paper-line bg-white">
          <h2 id={`g-${g}`} className="border-b border-paper-line px-5 py-3 font-display text-lg font-extrabold">{g}</h2>
          <ul className="divide-y divide-paper-line">
            {FEATURE_KEYS.filter((k) => FEATURES[k].group === g).map((k) => {
              const f = FEATURES[k], on = snap.state[k], c = snap.changes[k], id = `sw-${k}`;
              return (
                <li key={k} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p id={`${id}-l`} className="font-medium text-forest-900">{f.label}</p>
                    <p id={`${id}-d`} className="mt-0.5 text-sm text-ink-soft">{on ? f.on : f.off}</p>
                    <p className="mt-1 text-xs text-ink-muted">{c ? `Last changed ${when(c.updatedAt)} by ${c.updatedBy}` : `Default (${f.default ? "on" : "off"}); never changed`}</p>
                    {note?.key === k && <p role={note.tone === "err" ? "alert" : "status"} className={`mt-1 text-sm font-medium ${note.tone === "err" ? "text-danger-fg" : "text-primary"}`}>{note.text}</p>}
                  </div>
                  <button type="button" role="switch" aria-checked={on} aria-labelledby={`${id}-l`} aria-describedby={`${id}-d`} disabled={saving !== null} onClick={() => void toggle(k)}
                    className="inline-flex shrink-0 items-center gap-3 self-start rounded-full py-1 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60">
                    <span aria-hidden="true" className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${on ? "bg-primary" : "bg-neutral-300"}`}>
                      <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                    </span>
                    <span className={`w-14 text-left ${on ? "text-primary" : "text-ink-muted"}`}>{saving === k ? "Saving…" : on ? "On" : "Off"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
