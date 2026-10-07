import type { Application } from "@/types/application";
import { NIGERIAN_STATES } from "@/config/programme";
import { FOCAL_STATES, TARGETS, ZONE_NAMES, zoneOf } from "@/config/admin";
import { locationGroupFor } from "@/lib/location";

export const pct = (part: number, whole: number): number | null => (whole === 0 ? null : Math.round((part / whole) * 1000) / 10);
const tally = <T extends string>(items: T[]) => items.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
const rows = (m: Record<string, number>, total: number) =>
  Object.entries(m).map(([key, count]) => ({ key, count, pct: pct(count, total) })).sort((a, b) => b.count - a.count);

export interface TargetRow { id: string; label: string; target: number; current: number | null; gap: number | null; met: boolean | null; count: number }

export function computeAnalytics(all: Application[], draftCount = 0) {
  // Draft-status rows (if any ever exist in the Applications sheet) never count toward submitted metrics.
  const apps = all.filter((a) => a.submissionStatus !== "DRAFT");
  const total = apps.length;

  const byState = tally(apps.map((a) => a.location.state));
  const focalRows = FOCAL_STATES.map((s) => ({ state: s, count: byState[s] ?? 0, pct: pct(byState[s] ?? 0, total) }));
  const focalStateCount = focalRows.reduce((n, r) => n + r.count, 0);
  const otherStateCount = apps.filter((a) => locationGroupFor(a.location.state) === "OTHER_STATES").length;

  const otherRows = NIGERIAN_STATES.filter((s) => !(FOCAL_STATES as readonly string[]).includes(s))
    .map((s) => ({ state: s, count: byState[s] ?? 0, pct: pct(byState[s] ?? 0, total) }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));

  const female = apps.filter((a) => a.applicant.gender === "FEMALE").length;
  const male = apps.filter((a) => a.applicant.gender === "MALE").length;
  const disability = apps.filter((a) => a.inclusion.disability === "YES").length;
  const rural = apps.filter((a) => a.inclusion.rural).length;
  const sum = (f: (a: Application) => number) => apps.reduce((n, a) => n + f(a), 0);

  const target = (id: string, label: string, t: number, count: number): TargetRow => {
    const current = pct(count, total);
    return { id, label, target: t, current, gap: current === null ? null : Math.max(0, Math.round((t - current) * 10) / 10), met: current === null ? null : current >= t, count };
  };

  const ageBand = (a: Application) => (a.applicant.age <= 24 ? "18–24" : a.applicant.age <= 29 ? "25–29" : "30–35");

  return {
    total,
    submitted: total,
    drafts: draftCount,
    focal: {
      rows: focalRows,
      kadunaCount: byState.Kaduna ?? 0, nigerCount: byState.Niger ?? 0, nasarawaCount: byState.Nasarawa ?? 0,
      focalStateCount, otherStateCount,
      focalStatePercentage: pct(focalStateCount, total), otherStatePercentage: pct(otherStateCount, total),
    },
    zones: ZONE_NAMES.map((z) => { const count = apps.filter((a) => zoneOf(a.location.state) === z).length; return { zone: z, count, pct: pct(count, total) }; }),
    states: rows(byState, total).map((r) => ({ state: r.key, count: r.count, pct: r.pct })),
    otherStates: { total: otherStateCount, rows: otherRows, active: otherRows.filter((r) => r.count > 0).length },
    demographics: {
      female, male, disability, rural,
      femalePct: pct(female, total), malePct: pct(male, total), disabilityPct: pct(disability, total), ruralPct: pct(rural, total),
      age: rows(tally(apps.map(ageBand)), total).sort((a, b) => a.key.localeCompare(b.key)),
    },
    business: {
      valueChain: rows(tally(apps.map((a) => a.business.valueChain)), total),
      stage: rows(tally(apps.map((a) => a.business.stage)), total),
      revenue: rows(tally(apps.map((a) => a.business.revenueRange)), total),
      jobsCreated: sum((a) => a.impact.jobsCreated),
      farmersReached: sum((a) => a.impact.farmersReached),
      womenReached: sum((a) => a.impact.womenReached),
      youthReached: sum((a) => a.impact.youthReached),
      communitiesReached: sum((a) => a.impact.communitiesReached),
    },
    targets: [
      target("female", "Female participation", TARGETS.femalePct, female),
      target("rural", "Rural participation", TARGETS.ruralPct, rural),
      target("focal", "Focal-state participation", TARGETS.focalStatePct, focalStateCount),
    ],
  };
}
export type Analytics = ReturnType<typeof computeAnalytics>;
