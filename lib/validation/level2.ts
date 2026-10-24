import { z } from "zod";
import { NIGERIAN_STATES } from "@/config/programme";
import { L2_AGE, L2_CROPS, L2_DISABILITY, L2_EDUCATION, L2_GENDER, L2_REGISTRATION, L2_SETTING, YES_NO } from "@/config/level2";

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : s);
const text = (label: string, max: number) => z.preprocess((v) => clean(v) ?? "", z.string().min(1, `Please enter ${label}.`).max(max, `Please keep this under ${max} characters.`));
const optional = (max: number) => z.preprocess((v) => clean(v) ?? "", z.string().max(max, `Please keep this under ${max} characters.`)).default("");
const vals = <T extends readonly { value: string }[]>(l: T) => l.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];
const pick = <T extends readonly { value: string }[]>(l: T, message: string) => z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(vals(l), { errorMap: () => ({ message }) }));
const yesNo = (message: string) => pick(YES_NO, message);
const count = (label: string, max = 1_000_000) => z.preprocess((v) => (typeof v === "number" ? String(v) : typeof v === "string" ? v.replace(/[,\s]/g, "") : ""),
  z.string().min(1, `Please enter ${label}. Use 0 if none.`).regex(/^\d{1,7}$/, `Please enter a whole number for ${label}.`).refine((s) => Number(s) <= max, "That number looks too large."));
const url = (label: string) => z.preprocess((v) => clean(v) ?? "", z.string().max(500).refine((s) => s === "" || /^https:\/\/\S+$/i.test(s), `Please upload the ${label}, or paste a link that starts with https://.`)).default("");

export const level2Schema = z.object({
  // About the business and its owner
  businessName: text("the business name", 120),
  yearEstablished: z.preprocess((v) => (typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "Please enter the year the business was established.").regex(/^\d{4}$/, "Please enter a year, e.g. 2021.").refine((s) => Number(s) >= 1950 && Number(s) <= new Date().getFullYear(), "Please enter a year between 1950 and this year.")),
  contactName: z.preprocess((v) => (typeof v === "string" ? clean(v.replace(/\s+/g, " ")) : v ?? ""), z.string().min(3, "Please enter the name of the contact person (Founder/CEO).").max(100)
    .regex(/^[\p{L}][\p{L}\p{M}' .-]*$/u, "Please use letters only for the name.")),
  phone: z.preprocess((v) => (typeof v === "string" ? v.replace(/[\s\-()]/g, "") : v ?? ""), z.string().min(1, "Please enter a telephone number.").regex(/^\+?[0-9]{10,15}$/, "Please enter a valid phone number, e.g. 08031234567.")),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v ?? ""), z.string().min(1, "Please enter an email address.").email("Please enter a valid email address.").max(120)),
  state: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.enum(NIGERIAN_STATES as unknown as [string, ...string[]], { errorMap: () => ({ message: "Please select the state." }) })),
  lga: text("the Local Government Area (LGA)", 80),
  community: text("the community, village or ward", 120),
  setting: pick(L2_SETTING, "Please choose rural or urban."),
  ownerGender: pick(L2_GENDER, "Please choose the gender of the owner."),
  ownerAge: pick(L2_AGE, "Please choose the age of the owner."),
  disability: pick(L2_DISABILITY, "Please choose a disability status."),
  ownerEducation: pick(L2_EDUCATION, "Please choose the owner's highest level of education."),
  // The business
  cropType: pick(L2_CROPS, "Please choose the crop type."),
  cropTypeOther: optional(80),
  hasCac: yesNo("Please say whether the SME has a CAC certificate."),
  registrationType: pick(L2_REGISTRATION, "Please choose the type of registration."),
  registrationTypeOther: optional(80),
  permanentEmployees: count("the number of permanent employees", 100_000),
  casualEmployees: count("the number of casual employees", 100_000),
  trainedInputDistribution: yesNo("Please say whether the SME or owner has received training on input distribution."),
  inAssociation: yesNo("Please say whether the owner belongs to an association."),
  associationName: optional(150),
  farmersServed: count("the approximate number of farmers served in a year"),
  agraSupport: yesNo("Please say whether the SME received support from AGRA-funded projects."),
  hasBusinessBankAccount: yesNo("Please say whether the SME has a business bank account."),
  // Support needs
  needFinance: yesNo("Please answer this question."), needMarket: yesNo("Please answer this question."),
  needBds: yesNo("Please answer this question."), needTechnical: yesNo("Please answer this question."),
  hasOtherNeeds: yesNo("Please say whether the SME has other business needs."),
  otherNeeds: optional(600),
  // Documents (an upload stores an https link)
  doc1: url("business proposal, pitch deck or EOP"), doc2: url("second document"), doc3: url("third document"),
  smedanCertificate: url("SMEDAN certificate"), cacCertificate: url("CAC certificate"), bankProof: url("bank document"),
  declaration: z.literal(true, { errorMap: () => ({ message: "Please tick the box to confirm before submitting." }) }),
}).superRefine((v, ctx) => {
  const need = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (v.cropType === "OTHER" && !v.cropTypeOther) need("cropTypeOther", "Please say which crop.");
  if (v.registrationType === "OTHER" && !v.registrationTypeOther) need("registrationTypeOther", "Please describe the type of registration.");
  if (v.inAssociation === "YES" && !v.associationName) need("associationName", "Please give the name of the association.");
  if (v.hasOtherNeeds === "YES" && !v.otherNeeds) need("otherNeeds", "Please describe the other business needs.");
  if (!v.doc1) need("doc1", "Please upload at least one supporting document: a business proposal, pitch deck or EOP.");
  if (v.hasCac === "YES" && !v.cacCertificate) need("cacCertificate", "You said the SME has a CAC certificate: please upload it.");
});
export type Level2Form = z.infer<typeof level2Schema>;
export type Level2Errors = Record<string, string>;

export function validateLevel2(values: Record<string, unknown>) {
  const r = level2Schema.safeParse(values);
  if (r.success) return { ok: true as const, data: r.data, errors: {} as Level2Errors };
  const errors: Level2Errors = {};
  for (const i of r.error.issues) { const k = String(i.path[0] ?? "form"); if (!errors[k]) errors[k] = i.message; }
  return { ok: false as const, errors };
}
