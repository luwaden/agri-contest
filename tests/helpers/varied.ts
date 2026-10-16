import type { Application } from "../../types/application";
import { demoApplications } from "../../lib/demo";
import { NIGERIAN_STATES, VALUE_CHAINS, BUSINESS_STAGES, REVENUE_RANGES } from "../../config/programme";

/**
 * TEST DATA ONLY: applications with varied, realistic-looking answers (thin to strong), so screening has something to sort.
 * Seeded, so every run gets the same set.
 */
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }; }
const SENTENCES = [
  "Smallholder farmers in our area lose about 30% of their maize to pests and poor storage after harvest.",
  "We built a solar-powered dryer that cuts drying time from 7 days to 2 days for 40 bags at a time.",
  "Our mobile app links 350 rice farmers to verified buyers and pays them within 48 hours.",
  "We process soybean into fortified flour and sell it to 12 schools and 3 supermarkets in the state.",
  "The business has trained 120 women on improved seed and fertiliser use since 2023.",
  "We plan to expand to two more states through partnerships with cooperatives and an offtake agreement.",
  "Revenue comes from a service fee of ₦2,000 per bag and monthly subscriptions from aggregators.",
  "Customers are poultry farmers who need reliable maize feed at a fair price all year.",
  "Hermetic storage bags keep grain safe for 6 months without chemicals.",
  "We recycle cassava peels into animal feed, reducing waste and adding income for processors.",
  "The idea is to help farmers.", "We want to make agriculture better for everyone in Nigeria.",
  "Our drones map farms and advise on irrigation, saving water and improving yields by 20%.",
  "Youth in rural communities get jobs as field agents earning a monthly commission.",
];

export function variedApplications(count: number, seed = 7): Application[] {
  const r = rng(seed);
  const base = demoApplications(64);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const para = (min: number, max: number) => Array.from({ length: min + Math.floor(r() * (max - min + 1)) }, () => pick(SENTENCES)).join(" ");
  return Array.from({ length: count }, (_, i) => {
    const a: Application = structuredClone(base[i % base.length]);
    const strong = r();
    const n = (lo: number, hi: number) => Math.round(lo + (hi - lo) * strong * r());
    a.applicationId = `AGRA-2026-${String(i).padStart(6, "0").replace(/0/g, "Z").replace(/1/g, "Y")}`;
    a.applicant.firstName = `Test${i}`; a.applicant.lastName = `Person${i % 997}`; a.applicant.email = `t${i}@example.invalid`; a.applicant.phone = `080${String(10000000 + i)}`;
    a.applicant.gender = r() < 0.35 ? "FEMALE" : "MALE"; a.applicant.nationality = "Nigerian";
    a.location.state = pick(NIGERIAN_STATES); a.inclusion.rural = r() < 0.25;
    a.business.businessName = `Test Agribusiness ${i}`; a.business.valueChain = pick(VALUE_CHAINS).value;
    a.business.stage = strong > 0.7 ? pick(["OPERATING", "GROWING", "ESTABLISHED"]) : pick(BUSINESS_STAGES).value;
    a.business.description = para(1, 1 + Math.round(strong * 5)); a.business.problem = para(1, 1 + Math.round(strong * 4));
    a.business.solution = para(1, 1 + Math.round(strong * 5)); a.business.originality = para(0, Math.round(strong * 4)); a.business.innovation = para(0, Math.round(strong * 3));
    a.business.targetMarket = para(0, Math.round(strong * 3)); a.business.mainCustomers = para(0, 2); a.business.revenueSource = para(0, 2);
    a.business.generatesRevenue = strong > 0.4; a.business.revenueRange = a.business.generatesRevenue ? pick(REVENUE_RANGES.slice(1)).value : "NONE";
    a.business.customersServed = n(0, 3000); a.business.employees = { fullTime: n(0, 15), partTime: n(0, 10), youth: n(0, 8), women: n(0, 8) };
    a.impact.farmersReached = n(0, 4000); a.impact.jobsCreated = n(0, 40); a.impact.communitiesReached = n(0, 30);
    a.impact.socialImpact = para(0, Math.round(strong * 3)); a.impact.environmentalImpact = para(0, 2);
    a.submissionStatus = "SUBMITTED"; a.declaration.accepted = true;
    return a;
  });
}
