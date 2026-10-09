/**
 * Single source of truth for programme facts, option lists and targets.
 * Facts come from the Programme Concept Note v1.0 (Sept 2026) unless marked OVERRIDE.
 */

export const PROGRAMME = {
  name: "AGRA–SMEDAN Youth Agri-Innovation Contest",
  shortName: "Youth Agri-Innovation Contest",
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
  open: "2026-10-08T00:00:00+01:00",
  close: "2026-10-16T23:59:59+01:00",
} as const;

export const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo",
  "Ekiti","Enugu","Federal Capital Territory","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara",
  "Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara",
] as const;

/** LGA suggestions (type-ahead) for three states. Other states use free text until a verified national LGA list is added. */
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

/**
 * Partner data is configuration, not markup. Logos are the supplied files in /public/partners.
 * `w`/`h` are the real pixel size of each file so the browser reserves space (no layout shift) and never stretches it.
 */
export interface Partner { id: string; name: string; logo?: string; w?: number; h?: number; url?: string }

/** Top-of-site strip. ORDER IS A REQUIREMENT: AGRA, SMEDAN, Kaduna Business School, Jesnoch International, EDC. */
export const HEADER_PARTNERS: Partner[] = [
  { id: "agra", name: "AGRA", logo: "/partners/agra.png", w: 292, h: 116 },
  { id: "smedan", name: "SMEDAN", logo: "/partners/smedan.png", w: 645, h: 163 },
  { id: "kbs", name: "Kaduna Business School", logo: "/partners/kbs.png", w: 389, h: 239 },
  { id: "jesnoch", name: "Jesnoch International", logo: "/partners/jesnoch.png", w: 520, h: 160 },
  { id: "edc", name: "Enterprise Development Centre", logo: "/partners/edc.png", w: 480, h: 192 },
];

/** Footer, left side. */
export const FOOTER_PARTNERS: Partner[] = [
  { id: "agra", name: "AGRA", logo: "/partners/agra.png", w: 292, h: 116 },
  { id: "gates", name: "Gates Foundation", logo: "/partners/gates.png", w: 520, h: 64 },
  { id: "german", name: "German Cooperation", logo: "/partners/german-cooperation.png", w: 520, h: 291 },
  { id: "kfw", name: "KfW", logo: "/partners/kfw.png", w: 520, h: 266 },
  { id: "rockefeller", name: "The Rockefeller Foundation", logo: "/partners/rockefeller.png", w: 520, h: 142 },
  { id: "uk", name: "UK International Development", logo: "/partners/uk-international-development.png", w: 520, h: 145 },
];

/** Footer, right side. LOGO NOT YET SUPPLIED: add the file to /public/partners and set `logo`, `w`, `h` here. */
export const IMPLEMENTER: Partner = { id: "pih", name: "Plus Incubation Hub", logo: "/partners/pih-landscape.png", w: 1000, h: 500 };

/** Grand Finale date shown on the site. ONE place. Confirmed by the programme team: Thursday 29 October 2026.
 * FINALE_DATE_LABEL on the host still overrides it (remove that setting on Vercel if it holds an older date). */
export function finaleLabel(): string { return process.env.FINALE_DATE_LABEL?.trim() || "Thursday 29 October 2026"; }

/** Programme journey shown in "From application to award". Dates confirmed by the programme team. */
export const JOURNEY = [
  { step: "Apply", date: "8 to 16 October", note: "Apply online in three short stages. Save and continue any time." },
  { step: "Nationwide Training", date: "17 October", note: "Virtual training for all applicants." },
  { step: "In-person Training", date: "21 to 22 October", note: "Two days of in-person training in Niger, Nasarawa and Kaduna." },
  { step: "Pitch & Grand Finale", date: "29 October", note: "Hybrid: finalists pitch live, in the room and online." },
  { step: "National Showcase & Award", date: "8 to 10 November", note: "The national showcase and award ceremony in Lagos." },
] as const;

export const TIMELINE = [
  { label: "Applications open", date: "8 October 2026" },
  { label: "Applications close", date: "16 October 2026" },
  { label: "Grand Finale", date: finaleLabel() },
] as const;

