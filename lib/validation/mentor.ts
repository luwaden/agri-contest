import { z } from "zod";
import { NIGERIAN_STATES } from "@/config/programme";
import { PANEL_AVAILABILITY, PANEL_EXPERTISE, PANEL_ROLES } from "@/config/mentors";

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : s);
const text = (label: string, max: number) => z.preprocess((v) => clean(v) ?? "", z.string().min(1, `Please enter ${label}.`).max(max, `Please keep ${label} under ${max} characters.`));
const optional = (max: number) => z.preprocess((v) => clean(v) ?? "", z.string().max(max, `Please keep this under ${max} characters.`)).default("");
const vals = <T extends readonly { value: string }[]>(l: T) => l.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

const name = (label: string) => z.preprocess((v) => (typeof v === "string" ? clean(v.replace(/\s+/g, " ")) : v ?? ""),
  z.string().min(1, `Please enter your ${label}.`).max(60, `Please keep your ${label} under 60 characters.`)
    .regex(/^[\p{L}][\p{L}\p{M}' .-]*$/u, `Please use letters only for your ${label}.`));

/** Accepts "linkedin.com/in/ada", "www.linkedin.com/in/ada" or the full https:// link, and stores the full link. */
const linkedin = z.preprocess((v) => {
  const s = typeof v === "string" ? (clean(v) as string).replace(/\s+/g, "") : "";
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s.replace(/^http:\/\//i, "https://") : `https://${s}`;
}, z.string().min(1, "Please enter your LinkedIn profile link.").max(300, "That link is too long.").refine((s) => {
  try { const u = new URL(s); return u.protocol === "https:" && /(^|\.)linkedin\.com$/i.test(u.hostname) && u.pathname.length > 1; } catch { return false; }
}, "Please enter your LinkedIn profile link, e.g. https://www.linkedin.com/in/your-name."));

/**
 * Short application for mentors, judges and reviewers: everything is required except "anything else".
 * Each person applies for ONE role. Judges and reviewers also tick the conflict-of-interest declaration.
 */
export const mentorSchema = z.object({
  firstName: name("first name"),
  lastName: name("surname"),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v ?? ""), z.string().min(1, "Please enter your email address.").email("Please enter a valid email address, e.g. name@example.com.").max(120)),
  phone: z.preprocess((v) => (typeof v === "string" ? v.replace(/[\s\-()]/g, "") : v ?? ""), z.string().min(1, "Please enter your phone number.").regex(/^\+?[0-9]{7,15}$/, "Please enter a valid phone number, with country code if outside Nigeria.")),
  state: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum([...NIGERIAN_STATES, "Outside Nigeria"] as [string, ...string[]], { errorMap: () => ({ message: "Please select where you are based." }) })),
  profession: text("your current role and organisation", 200),
  yearsExperience: z.preprocess((v) => (typeof v === "string" ? v.trim() : v ?? ""), z.string().min(1, "Please enter your years of experience.").regex(/^\d{1,2}$/, "Please enter a whole number of years, e.g. 8.").refine((s) => Number(s) <= 60, "That number looks too large.")),
  role: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(vals(PANEL_ROLES), { errorMap: () => ({ message: "Please choose what you would like to serve as." }) })),
  expertise: z.array(z.enum(vals(PANEL_EXPERTISE)), { invalid_type_error: "Please select at least one area." }).min(1, "Please select at least one area of expertise."),
  availability: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(vals(PANEL_AVAILABILITY), { errorMap: () => ({ message: "Please tell us how much time you could offer." }) })),
  linkedin,
  motivation: optional(500),
  coi: z.boolean().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to confirm before submitting." }) }),
}).superRefine((v, ctx) => {
  if ((v.role === "JUDGE" || v.role === "REVIEWER") && v.coi !== true)
    ctx.addIssue({ code: "custom", path: ["coi"], message: "Judges and reviewers must agree to declare any conflict of interest." });
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
