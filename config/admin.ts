/**
 * ADMIN / ANALYTICS-ONLY configuration. Nothing here is shown to applicants or referenced by public pages.
 * The public site is a Nigeria-wide programme; these definitions only let administrators segment the applicant pool
 * and compare it with internal programme targets.
 */
/** States the programme team wants to analyse separately. */
export const FOCAL_STATES = ["Kaduna", "Niger", "Nasarawa"] as const;
export type FocalState = (typeof FOCAL_STATES)[number];
export type LocationGroup = "FOCAL_STATES" | "OTHER_STATES";


/** Internal targets (concept note). Never published. */
export const TARGETS = {
  femalePct: 30,
  ruralPct: 20,
  focalStatePct: 60,
  submissions: 200,
} as const;


/** Six geopolitical zones. Used for ADMIN analytics only; never shown to applicants. */
export const GEOPOLITICAL_ZONES: Record<string, readonly string[]> = {
  "North Central": ["Benue", "Federal Capital Territory", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau"],
  "North East": ["Adamawa", "Bauchi", "Borno", "Gombe", "Taraba", "Yobe"],
  "North West": ["Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Sokoto", "Zamfara"],
  "South East": ["Abia", "Anambra", "Ebonyi", "Enugu", "Imo"],
  "South South": ["Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Rivers"],
  "South West": ["Ekiti", "Lagos", "Ogun", "Ondo", "Osun", "Oyo"],
};
export const ZONE_NAMES = Object.keys(GEOPOLITICAL_ZONES);
export const zoneOf = (state: string): string =>
  ZONE_NAMES.find((z) => GEOPOLITICAL_ZONES[z].includes(state)) ?? "Unknown";
