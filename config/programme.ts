/**
 * Single source of truth for programme facts, option lists and targets.
 * Facts come from the Programme Concept Note v1.0 (Sept 2026) unless marked OVERRIDE.
 */

export const PROGRAMME = {
  name: "AGRA–SMEDAN Youth in Agribusiness Innovation Contest",
  shortName: "Youth in Agribusiness Innovation Contest",
  tagline: "Finding, funding and scaling the next generation of Nigerian agripreneurs.",
  hashtag: "#AGRASMEDANYouthAgriInnovate",
  refPrefix: "AGRA",
  eligibility: { minAge: 18, maxAge: 35 },
  contactEmail: "plusincubationhub@gmail.com",
  deliveredBy: "Plus Incubation Hub Nigeria Limited",
} as const;

/**
 * OVERRIDE: the implementation brief sets 2–16 October 2026.
 * The concept note lists a public launch of 12 Oct and call closure of 15 Nov.
 * Dates are read from env so they can change without a code edit. Times are Africa/Lagos (WAT, UTC+1).
 */
export const APPLICATION_WINDOW_DEFAULTS = {
  open: "2026-09-30T00:00:00+01:00",
  close: "2026-10-16T23:59:59+01:00",
} as const;

export const FOCAL_STATES = ["Kaduna", "Niger", "Nasarawa"] as const;
export type FocalState = (typeof FOCAL_STATES)[number];
export type LocationGroup = "FOCAL_STATES" | "OTHER_STATES";

export const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo",
  "Ekiti","Enugu","Federal Capital Territory","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara",
  "Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara",
] as const;

/** LGA suggestions for focal states only. Other states use free text (774 LGAs; a verified dataset is a Batch 2 item). */
export const LGA_SUGGESTIONS: Record<string, string[]> = {
  Kaduna: ["Birnin Gwari","Chikun","Giwa","Igabi","Ikara","Jaba","Jema'a","Kachia","Kaduna North","Kaduna South","Kagarko","Kajuru","Kaura","Kauru","Kubau","Kudan","Lere","Makarfi","Sabon Gari","Sanga","Soba","Zangon Kataf","Zaria"],
  Niger: ["Agaie","Agwara","Bida","Borgu","Bosso","Chanchaga","Edati","Gbako","Gurara","Katcha","Kontagora","Lapai","Lavun","Magama","Mariga","Mashegu","Mokwa","Moya","Paikoro","Rafi","Rijau","Shiroro","Suleja","Tafa","Wushishi"],
  Nasarawa: ["Akwanga","Awe","Doma","Karu","Keana","Keffi","Kokona","Lafia","Nasarawa","Nasarawa Egon","Obi","Toto","Wamba"],
};

export const GENDERS = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
] as const;

export const DISABILITY_OPTIONS = [
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
] as const;

export const DISABILITY_TYPES = [
  { value: "VISUAL", label: "Visual" },
  { value: "HEARING", label: "Hearing" },
  { value: "PHYSICAL", label: "Physical / mobility" },
  { value: "INTELLECTUAL", label: "Intellectual or learning" },
  { value: "PSYCHOSOCIAL", label: "Psychosocial" },
  { value: "MULTIPLE", label: "More than one" },
  { value: "OTHER", label: "Other" },
] as const;

export const SETTINGS = [
  { value: "RURAL", label: "Rural" },
  { value: "URBAN", label: "Urban or peri-urban" },
] as const;

export const LANGUAGES = [
  "English","Hausa","Yoruba","Igbo","Nupe","Gbagyi (Gwari)","Fulfulde","Tiv","Kanuri","Idoma","Igala","Edo","Efik / Ibibio","Ijaw","Urhobo","Berom","Eggon","Gade","Other",
] as const;

export const VALUE_CHAINS = [
  { value: "MAIZE", label: "Maize" },
  { value: "RICE", label: "Rice" },
  { value: "SOYBEAN", label: "Soybean" },
  { value: "ALLIED", label: "Allied agrifood commodities" },
  { value: "OTHER", label: "Other" },
] as const;

export const BUSINESS_STAGES = [
  { value: "IDEA", label: "Idea stage", hint: "Not yet trading" },
  { value: "EARLY", label: "Early stage", hint: "Testing with first customers" },
  { value: "OPERATING", label: "Operating business", hint: "Regular sales" },
  { value: "GROWING", label: "Growing business", hint: "Expanding customers or team" },
  { value: "ESTABLISHED", label: "Established business", hint: "Stable operations" },
] as const;

export const REGISTRATION_STATUSES = [
  { value: "CAC_REGISTERED", label: "Registered with CAC" },
  { value: "IN_PROGRESS", label: "Registration in progress" },
  { value: "NOT_REGISTERED", label: "Not yet registered" },
] as const;

export const APPLICANT_ROLES = [
  { value: "FOUNDER", label: "Founder" },
  { value: "CO_FOUNDER", label: "Co-founder" },
  { value: "OWNER", label: "Owner" },
  { value: "DIRECTOR", label: "Director" },
  { value: "MANAGER", label: "Manager" },
  { value: "OTHER", label: "Other" },
] as const;

export const REVENUE_RANGES = [
  { value: "NONE", label: "No revenue yet" },
  { value: "UNDER_1M", label: "Under ₦1 million" },
  { value: "1M_5M", label: "₦1 million – ₦5 million" },
  { value: "5M_20M", label: "₦5 million – ₦20 million" },
  { value: "20M_50M", label: "₦20 million – ₦50 million" },
  { value: "OVER_50M", label: "Over ₦50 million" },
] as const;

export const AGRI_IMPACT_AREAS = [
  { value: "FOOD_PRODUCTION", label: "Increases food production" },
  { value: "PRODUCTIVITY", label: "Improves farm productivity or yields" },
  { value: "WASTE_REDUCTION", label: "Reduces waste" },
  { value: "POST_HARVEST", label: "Reduces post-harvest losses" },
  { value: "CLIMATE_SMART", label: "Promotes climate-smart practices" },
  { value: "AGRI_SERVICES", label: "Improves access to agricultural services" },
  { value: "MARKET_ACCESS", label: "Improves farmers' market access" },
] as const;

export const SUPPORT_NEEDS = [
  { value: "FINANCE", label: "Access to finance" },
  { value: "BUSINESS_DEV", label: "Business development" },
  { value: "FIN_MGMT", label: "Financial management" },
  { value: "MARKETING", label: "Marketing" },
  { value: "BRANDING", label: "Branding" },
  { value: "MARKET_ACCESS", label: "Market access" },
  { value: "TECHNOLOGY", label: "Technology" },
  { value: "MENTORSHIP", label: "Mentorship" },
  { value: "INVESTOR_READY", label: "Investor readiness" },
  { value: "RECORD_KEEPING", label: "Record keeping" },
  { value: "FORMALISATION", label: "Business formalisation" },
  { value: "OTHER", label: "Other" },
] as const;

export const DOCUMENT_KINDS = [
  { value: "PITCH_DECK", label: "Pitch deck" },
  { value: "BUSINESS_DOC", label: "Business document" },
  { value: "REGISTRATION", label: "Registration document" },
  { value: "PRODUCT_IMAGES", label: "Product images" },
  { value: "EVIDENCE", label: "Supporting evidence" },
] as const;

/** Concept note §3.2 and §5 */
export const TARGETS = {
  femalePct: 30,
  ruralPct: 20,
  focalStatePct: 60,
  submissions: 200,
} as const;

export const STATUSES = [
  { value: "DRAFT", label: "Draft", applicantVisible: false },
  { value: "SUBMITTED", label: "Submitted", applicantVisible: true },
  { value: "UNDER_REVIEW", label: "Under review", applicantVisible: false },
  { value: "SHORTLISTED", label: "Shortlisted", applicantVisible: false },
  { value: "NOT_SELECTED", label: "Not selected", applicantVisible: false },
  { value: "FINALIST", label: "Finalist", applicantVisible: false },
  { value: "WINNER", label: "Winner", applicantVisible: false },
] as const;
/** Statuses an admin may set in the current stage. Extend in Batch 4. */
export const ACTIVE_STATUS_TRANSITIONS: readonly string[] = ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "NOT_SELECTED"];

/** Partner data is configuration, not markup. Drop real logos in /public/partners and set `logo`. */
export interface Partner { id: string; name: string; role: string; logo?: string; url?: string }
export const PARTNERS: Partner[] = [
  { id: "agra", name: "AGRA", role: "Funder" },
  { id: "smedan", name: "SMEDAN", role: "Implementing partner" },
  { id: "jesnoch", name: "Jesnoch International", role: "Technical adviser" },
  { id: "piata", name: "PIATA", role: "Partner" },
  { id: "edc", name: "EDC", role: "Partner" },
  { id: "kbs", name: "KBS", role: "Partner" },
];

export const TIMELINE = [
  { label: "Applications open", date: "2 October 2026" },
  { label: "Applications close", date: "16 October 2026" },
  { label: "Round 1: shortlist to Top 100", date: "Announced by programme team" },
  { label: "Round 2: pitches to Top 30", date: "Announced by programme team" },
  { label: "Grand Finale and Deal Room", date: "Thursday 10 December 2026" },
] as const;
