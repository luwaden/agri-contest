import type { Application } from "@/types/application";
import { FOCAL_STATES, NIGERIAN_STATES, VALUE_CHAINS, BUSINESS_STAGES } from "@/config/programme";
import { SAMPLE_VALUES } from "@/lib/demo-values";
import { validateAll } from "@/lib/validation/application";
import { toApplication } from "@/lib/mapper";

/** Seeded PRNG so demo data is stable between reloads. */
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const CODE = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * DEMO ONLY. Generated in memory when NEXT_PUBLIC_DEMO_MODE=true (never in production).
 * It is never written to the real data store and is labelled in the admin UI.
 */
export function demoApplications(count = 64): Application[] {
  const r = rng(2026);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const out: Application[] = [];
  for (let i = 0; i < count; i++) {
    const focal = r() < 0.55;
    const state = focal ? pick(FOCAL_STATES) : pick(NIGERIAN_STATES.filter((s) => !(FOCAL_STATES as readonly string[]).includes(s)));
    const female = r() < 0.36; const rural = r() < 0.27;
    const values = {
      ...SAMPLE_VALUES, firstName: `Demo${i + 1}`, lastName: "Applicant", email: `demo${i + 1}@example.invalid`,
      gender: female ? "FEMALE" : "MALE", state, businessState: state, lga: "Demo LGA",
      dateOfBirth: `${1991 + Math.floor(r() * 12)}-0${1 + Math.floor(r() * 9)}-15`,
      residenceSetting: rural ? "RURAL" : "URBAN", businessSetting: rural ? "RURAL" : "URBAN",
      disability: r() < 0.05 ? "YES" : "NO", disabilityType: "", accessibilityNeeds: "",
      valueChain: pick(VALUE_CHAINS).value, businessStage: pick(BUSINESS_STAGES).value, yearStarted: "2022",
      businessName: `Demo Agribusiness ${i + 1}`, jobsCreated: String(Math.floor(r() * 20)), farmersReached: String(Math.floor(r() * 500)),
    };
    if (values.disability === "YES") values.disabilityType = "PHYSICAL";
    const code = Array.from({ length: 6 }, () => CODE[Math.floor(r() * CODE.length)]).join("");
    const parsed = validateAll(values);
    const app = toApplication(parsed.data, { applicationId: `AGRA-2026-${code}`, status: pick(["SUBMITTED", "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] as const), now: new Date(Date.UTC(2026, 9, 2 + Math.floor(r() * 14), 9)), source: "demo" });
    out.push(app);
  }
  return out;
}
