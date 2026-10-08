import { z } from "zod";
import { NIGERIAN_STATES } from "@/config/programme";
import { PANEL_AVAILABILITY, PANEL_EXPERTISE, PANEL_ROLES } from "@/config/mentors";

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : s);
const text = (label: string, max: number) => z.preprocess(clean, z.string().min(1, `Please enter ${label}.`).max(max, `Please keep ${label} under ${max} characters.`));
const optional = (max: number) => z.preprocess((v) => clean(v) ?? "", z.string().max(max, `Please keep this under ${max} characters.`)).default("");
const vals = <T extends readonly { value: string }[]>(l: T) => l.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

/**
 * Short application for mentors, judges and reviewers: 8 required answers (+ a conflict-of-interest tick for judges
 * and reviewers), 2 optional. Fields that older records had (industry, portfolio, CV...) are no longer asked.
 */
export const mentorSchema = z.object({
  fullName: text("your full name", 120),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v ?? ""), z.string().min(1, "Please enter your email address.").email("Please enter a valid email address, e.g. name@example.com.").max(120)),
  phone: z.preprocess((v) => (typeof v === "string" ? v.replace(/[\s\-()]/g, "") : v ?? ""), z.string().min(1, "Please enter your phone number.").regex(/^\+?[0-9]{7,15}$/, "Please enter a valid phone number, with country code if outside Nigeria.")),
  state: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum([...NIGERIAN_STATES, "Outside Nigeria"] as [string, ...string[]], { errorMap: () => ({ message: "Please select where you are based." }) })),
  profession: text("your current role and organisation", 200),
  yearsExperience: z.preprocess((v) => (typeof v === "string" ? v.trim() : v ?? ""), z.string().min(1, "Please enter your years of experience.").regex(/^\d{1,2}$/, "Please enter a whole number of years, e.g. 8.").refine((s) => Number(s) <= 60, "That number looks too large.")),
  roles: z.array(z.enum(vals(PANEL_ROLES)), { invalid_type_error: "Please choose at least one role." }).min(1, "Please choose at least one role."),
  expertise: z.array(z.enum(vals(PANEL_EXPERTISE)), { invalid_type_error: "Please select at least one area." }).min(1, "Please select at least one area of expertise."),
  availability: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(vals(PANEL_AVAILABILITY), { errorMap: () => ({ message: "Please tell us how much time you could offer." }) })),
  motivation: optional(500),
  linkedin: z.preprocess((v) => clean(v) ?? "", z.string().max(300).refine((s) => s === "" || /^https:\/\/[^\s]+\.[^\s]+$/i.test(s), "Please enter a full link starting with https://.")).default(""),
  coi: z.boolean().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to confirm before submitting." }) }),
}).superRefine((v, ctx) => {
  if ((v.roles.includes("JUDGE") || v.roles.includes("REVIEWER")) && v.coi !== true)
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
