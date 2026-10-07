import { z } from "zod";
import { NIGERIAN_STATES } from "@/config/programme";
import { MENTOR_AREAS, MENTOR_AVAILABILITY } from "@/config/mentors";
import { NIGERIAN_PHONE } from "@/lib/validation/application";

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : s);
const text = (label: string, max: number, min = 1) =>
  z.preprocess(clean, z.string().min(min, min > 1 ? `Please write at least ${min} characters for ${label}.` : `Please enter ${label}.`).max(max, `Please keep ${label} under ${max} characters.`));
const optional = (max: number) => z.preprocess((v) => clean(v) ?? "", z.string().max(max)).default("");
const optionalUrl = (label: string) => z.preprocess((v) => clean(v) ?? "", z.string().max(300).refine((s) => s === "" || /^https:\/\/[^\s]+\.[^\s]+$/i.test(s), `Please enter a full link starting with https:// for ${label}.`)).default("");
const vals = <T extends readonly { value: string }[]>(l: T) => l.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

export const mentorSchema = z.object({
  fullName: text("your full name", 120),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v ?? ""), z.string().min(1, "Please enter your email address.").email("Please enter a valid email address, e.g. name@example.com.").max(120)),
  phone: z.preprocess((v) => (typeof v === "string" ? v.replace(/[\s\-()]/g, "") : v ?? ""), z.string().min(1, "Please enter your phone number.").regex(/^\+?[0-9]{7,15}$/, "Please enter a valid phone number, with country code if outside Nigeria.")),
  state: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum([...NIGERIAN_STATES, "Outside Nigeria"] as [string, ...string[]], { errorMap: () => ({ message: "Please select where you are based." }) })),
  location: text("your city or town", 120),
  profession: text("your professional background", 160),
  organization: text("your organisation", 160),
  industry: text("your industry", 120),
  yearsExperience: z.preprocess((v) => (typeof v === "string" ? v.trim() : v ?? ""), z.string().min(1, "Please enter your years of experience.").regex(/^\d{1,2}$/, "Please enter a whole number of years, e.g. 8.").refine((s) => Number(s) <= 60, "That number looks too large.")),
  mentorshipExperience: text("your mentoring experience (or write “None yet”)", 800),
  expertise: z.array(z.enum(vals(MENTOR_AREAS)), { invalid_type_error: "Please select at least one area." }).min(1, "Please select at least one area you can mentor in."),
  availability: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(vals(MENTOR_AVAILABILITY), { errorMap: () => ({ message: "Please tell us how much time you could offer." }) })),
  availabilityNotes: optional(500),
  linkedin: optionalUrl("your LinkedIn profile"),
  portfolio: optionalUrl("your portfolio or website"),
  motivation: text("why you would like to mentor", 800, 20),
  docCv: optionalUrl("your CV or supporting document"),
  consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to confirm before submitting." }) }),
});
export type MentorForm = z.infer<typeof mentorSchema>;
export type MentorErrors = Record<string, string>;

export function validateMentor(values: Record<string, unknown>) {
  const r = mentorSchema.safeParse(values);
  if (r.success) return { ok: true as const, data: r.data, errors: {} as MentorErrors };
  const errors: MentorErrors = {};
  for (const i of r.error.issues) { const k = String(i.path[0] ?? "form"); if (!errors[k]) errors[k] = i.message; }
  return { ok: false as const, errors };
}
