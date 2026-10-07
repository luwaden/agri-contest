import { z } from "zod";
import {
  APPLICANT_ROLES, BUSINESS_STAGES, DISABILITY_OPTIONS, GENDERS, LANGUAGES, NIGERIAN_STATES,
  PROGRAMME, REGISTRATION_STATUSES, REVENUE_RANGES, SETTINGS, SUPPORT_NEEDS, VALUE_CHAINS, AGRI_IMPACT_AREAS,
} from "@/config/programme";
import { calculateAge } from "@/lib/dates";

/** Character limits are shared by the UI counters and the server. */
export const LIMITS = {
  name: 60, short: 120, address: 200, description: 600, answer: 800, mid: 500, url: 300,
} as const;

const vals = <T extends readonly { value: string }[]>(list: T) =>
  list.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

const clean = (s: unknown) =>
  typeof s === "string" ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : s;

const text = (label: string, max: number, min = 1) =>
  z.preprocess(clean, z.string({ required_error: `Please enter ${label}.` })
    .min(min, min > 1 ? `Please write at least ${min} characters for ${label}.` : `Please enter ${label}.`)
    .max(max, `Please keep ${label} under ${max} characters.`));

const optionalText = (label: string, max: number) =>
  z.preprocess((v) => clean(v) ?? "", z.string().max(max, `Please keep ${label} under ${max} characters.`)).default("");

const choice = <T extends [string, ...string[]]>(values: T, msg: string) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(values, { errorMap: () => ({ message: msg }) }));

/** Numeric text input: "" is invalid where required; whole numbers only. */
const count = (label: string, max = 10_000_000) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v ?? ""),
    z.string()
      .min(1, `Please enter ${label}. Use 0 if none.`)
      .regex(/^\d+$/, `${label[0].toUpperCase()}${label.slice(1)} must be a whole number.`)
      .refine((s) => Number(s) <= max, `That number looks too large for ${label}.`));

const optionalUrl = (label: string) =>
  z.preprocess((v) => clean(v) ?? "", z.string().max(LIMITS.url).refine(
    (s) => s === "" || /^https:\/\/[^\s]+\.[^\s]+$/i.test(s), `Please enter a full link starting with https:// for ${label}.`)).default("");

export const NIGERIAN_PHONE = /^(?:\+234|234|0)[789][01]\d{8}$/;
export const normalisePhone = (s: string) => {
  const d = s.replace(/[\s\-()]/g, "");
  return d.startsWith("+234") ? d : d.startsWith("234") ? `+${d}` : `+234${d.slice(1)}`;
};
const phone = (label: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.replace(/[\s\-()]/g, "") : v ?? ""),
    z.string().min(1, `Please enter ${label}.`)
      .regex(NIGERIAN_PHONE, `Please enter a valid Nigerian number for ${label}, e.g. 0803 000 0000.`));

const stateField = (msg: string) => choice(NIGERIAN_STATES as unknown as [string, ...string[]], msg);
const currentYear = () => new Date().getFullYear();

// ─────────── Stage 1 ───────────
export const stage1Schema = z.object({
  firstName: text("your first name", LIMITS.name),
  middleName: optionalText("your middle name", LIMITS.name),
  lastName: text("your last name", LIMITS.name),
  gender: choice(vals(GENDERS), "Please select your gender."),
  dateOfBirth: z.preprocess(clean, z.string().min(1, "Please enter your date of birth.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date of birth.")),
  phone: phone("your phone number"),
  whatsapp: z.preprocess((v) => (typeof v === "string" ? v.replace(/[\s\-()]/g, "") : v ?? ""),
    z.string().refine((s) => s === "" || NIGERIAN_PHONE.test(s), "Please enter a valid WhatsApp number, or leave it blank.")).default(""),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v ?? ""),
    z.string().min(1, "Please enter your email address.")
      .email("Please enter a valid email address, e.g. name@example.com.").max(120)),
  nationality: text("your nationality", LIMITS.short),
  state: stateField("Please select your state of residence."),
  lga: text("your Local Government Area", LIMITS.short),
  community: text("your community or town", LIMITS.short),
  address: text("your address", LIMITS.address),
  residenceSetting: choice(vals(SETTINGS), "Please tell us whether you live in a rural or urban area."),
  languages: z.array(z.enum(LANGUAGES), { invalid_type_error: "Please select at least one language." }).min(1, "Please select at least one language."),
  languagesOther: optionalText("other languages", LIMITS.short),
  disability: choice(vals(DISABILITY_OPTIONS), "Please choose an option. You can select “Prefer not to say”."),
  disabilityType: optionalText("disability type", LIMITS.short),
  accessibilityNeeds: optionalText("accessibility support", LIMITS.mid),
}).superRefine((v, ctx) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v.dateOfBirth)) {
    const age = calculateAge(v.dateOfBirth);
    const { minAge, maxAge } = PROGRAMME.eligibility;
    if (age === null) ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Please enter a valid date of birth." });
    else if (age < minAge || age > maxAge)
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: `This contest is for young people aged ${minAge} to ${maxAge}. Based on your date of birth you are ${age}.` });
  }
  if (v.languages.includes("Other") && !v.languagesOther)
    ctx.addIssue({ code: "custom", path: ["languagesOther"], message: "Please tell us which other language you speak." });
  if (v.disability === "YES" && !v.disabilityType)
    ctx.addIssue({ code: "custom", path: ["disabilityType"], message: "Please select the type that best describes your disability." });
});

// ─────────── Stage 2 ───────────
export const stage2Schema = z.object({
  businessName: text("your business name", LIMITS.short),
  registrationStatus: choice(vals(REGISTRATION_STATUSES), "Please select your registration status."),
  registrationNumber: optionalText("the registration number", 40),
  businessStage: choice(vals(BUSINESS_STAGES), "Please select your business stage."),
  yearStarted: z.preprocess((v) => (typeof v === "string" ? v.trim() : v ?? ""),
    z.string().refine((s) => s === "" || (/^\d{4}$/.test(s) && Number(s) >= 1980 && Number(s) <= currentYear()), `Please enter a year between 1980 and ${currentYear()}.`)).default(""),
  businessState: stateField("Please select the state where your business operates."),
  businessLga: text("the business Local Government Area", LIMITS.short),
  businessAddress: text("the business address", LIMITS.address),
  businessSetting: choice(vals(SETTINGS), "Please tell us whether the business operates in a rural or urban area."),
  website: optionalUrl("your website"),
  socialHandles: optionalText("your social media handles", LIMITS.short),
  valueChain: choice(vals(VALUE_CHAINS), "Please select your main value chain."),
  valueChainOther: optionalText("the value chain", LIMITS.short),
  applicantRole: choice(vals(APPLICANT_ROLES), "Please select your role in the business."),
  applicantRoleOther: optionalText("your role", LIMITS.short),
  description: text("a short description of your agribusiness", LIMITS.description, 30),
  problem: text("the problem your business is solving", LIMITS.answer, 30),
  solution: text("how your solution works", LIMITS.answer, 30),
  originality: text("what makes your solution different", LIMITS.mid, 20),
  innovation: text("what is innovative about your approach", LIMITS.mid, 20),
  mainCustomers: text("who your main customers are", LIMITS.mid),
  targetMarket: text("your target market", LIMITS.mid),
  customersServed: count("the number of customers or users you serve"),
  generatesRevenue: choice(["YES", "NO"], "Please tell us whether the business is earning revenue."),
  revenueRange: optionalText("revenue range", 20),
  revenueSource: optionalText("main source of revenue", LIMITS.mid),
  fullTime: count("full-time employees"),
  partTime: count("part-time employees"),
  youthEmployed: count("young people employed"),
  womenEmployed: count("women employed"),
  farmersReached: count("farmers reached"),
  jobsCreated: count("jobs created"),
  womenReached: count("women reached"),
  youthReached: count("youth reached"),
  communitiesReached: count("rural communities reached"),
}).superRefine((v, ctx) => {
  const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (v.registrationStatus === "CAC_REGISTERED" && !v.registrationNumber) add("registrationNumber", "Please enter your CAC registration number.");
  if (v.businessStage !== "IDEA" && !v.yearStarted) add("yearStarted", "Please enter the year your business started.");
  if (v.valueChain === "OTHER" && !v.valueChainOther) add("valueChainOther", "Please tell us which value chain you work in.");
  if (v.applicantRole === "OTHER" && !v.applicantRoleOther) add("applicantRoleOther", "Please describe your role.");
  if (v.generatesRevenue === "YES" && !(REVENUE_RANGES.map((r) => r.value) as string[]).includes(v.revenueRange))
    add("revenueRange", "Please select an approximate annual revenue range.");
  const staff = Number(v.fullTime) + Number(v.partTime);
  if (Number(v.youthEmployed) > staff) add("youthEmployed", "This cannot be more than your total number of employees.");
  if (Number(v.womenEmployed) > staff) add("womenEmployed", "This cannot be more than your total number of employees.");
});

// ─────────── Stage 3 ───────────
export const stage3Schema = z.object({
  socialImpact: text("the measurable change your business has created", LIMITS.answer, 20),
  beneficiaries: text("who benefits most from your business", LIMITS.mid),
  peopleBenefited: count("the number of people who have benefited"),
  agriImpactAreas: z.array(z.enum(vals(AGRI_IMPACT_AREAS))).default([]),
  environmentalImpact: optionalText("your agricultural impact description", LIMITS.answer),
  supportNeeds: z.array(z.enum(vals(SUPPORT_NEEDS)), { invalid_type_error: "Please select at least one type of support." }).min(1, "Please select at least one type of support."),
  supportNeedsOther: optionalText("other support", LIMITS.short),
  programmeGoal: text("what you hope to achieve through this programme", LIMITS.mid, 20),
  docPitchDeck: optionalUrl("the pitch deck"),
  docBusiness: optionalUrl("the business document"),
  docRegistration: optionalUrl("the registration document"),
  docImages: optionalUrl("the product images"),
  docEvidence: optionalUrl("the supporting evidence"),
}).superRefine((v, ctx) => {
  if (v.supportNeeds.includes("OTHER") && !v.supportNeedsOther)
    ctx.addIssue({ code: "custom", path: ["supportNeedsOther"], message: "Please tell us what other support you need." });
});

export const declarationSchema = z.object({
  declaration: z.literal(true, { errorMap: () => ({ message: "Please tick the box to confirm the declaration before submitting." }) }),
});

export type FormValues = Record<string, unknown>;
export type FieldErrors = Record<string, string>;
export type ParsedForm = Record<string, any>;

function issuesToErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of error.issues) { const k = String(i.path[0] ?? "form"); if (!out[k]) out[k] = i.message; }
  return out;
}

export const STAGE_SCHEMAS = [stage1Schema, stage2Schema, stage3Schema] as const;

export function validateStage(stage: 0 | 1 | 2, values: FormValues):
  { ok: true; data: ParsedForm; errors: FieldErrors } | { ok: false; errors: FieldErrors } {
  const r = STAGE_SCHEMAS[stage].safeParse(values);
  return r.success ? { ok: true, data: r.data as ParsedForm, errors: {} } : { ok: false, errors: issuesToErrors(r.error) };
}

export function validateAll(values: FormValues) {
  const errors: FieldErrors[] = [{}, {}, {}];
  let data: ParsedForm = {};
  ([0, 1, 2] as const).forEach((s) => {
    const r = validateStage(s, values);
    if (r.ok) data = { ...data, ...r.data }; else errors[s] = r.errors;
  });
  const d = declarationSchema.safeParse(values);
  const declarationError = d.success ? undefined : d.error.issues[0].message;
  const ok = errors.every((e) => Object.keys(e).length === 0) && !declarationError;
  return { ok, data, errors, declarationError };
}
