import "server-only";
import { getRepository } from "@/lib/repository";
import { loadApplications } from "@/lib/data";
import { L2_DOC_FIELDS, STORED_L2_FILE, validateLevel2, type Level2Form } from "@/lib/validation/level2";
import { issueLevel2Token, readLevel2Token } from "@/lib/level2/token";
import { emailLevel2Received } from "@/lib/email/notify";
import { LEVEL2, L2_CROPS } from "@/config/level2";
import { PROGRAMME } from "@/config/programme";
import { REFERENCE_PATTERN } from "@/lib/reference";
import { OFF_MESSAGE, featureOn } from "@/lib/features";
import { LEVEL2_COLUMNS } from "@/lib/google-sheets/level2Schema";
import { csvCell } from "@/lib/csv";
import type { Application } from "@/types/application";
import type { Level2Application, Level2Invite } from "@/types/level2";
import type { ServiceResult } from "./applicationService";

/**
 * LEVEL 2 (invited Level 1 applicants only).
 *
 *   code + Level 1 email ──▶ invited? not yet submitted? ──▶ signed pass (3 h) + answers known from Level 1
 *   form + pass ──▶ checked again ──▶ ONE row in "Level 2 Applications" ──▶ confirmation email
 *
 * The page is not linked anywhere, but that is not the protection: the invite list and the code+email check are.
 */
const fail = (status: number, message: string, extra: Record<string, unknown> = {}) => ({ ok: false as const, status, body: { message, ...extra } });
export const cleanCode = (s: unknown) => (typeof s === "string" ? s : "").normalize("NFKC").toUpperCase().replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-").replace(/[^A-Z0-9-]/g, "");
export const cleanEmail = (s: unknown) => (typeof s === "string" ? s : "").normalize("NFKC").replace(/[\s\u200B-\u200D\uFEFF\u00A0]/g, "").replace(/^mailto:/i, "").toLowerCase();
const norm = (s: unknown) => (typeof s === "string" ? s.trim() : "");
const closed = () => { const c = LEVEL2.closeDate(); return !!c && Date.now() > new Date(c).getTime(); };
const NOT_FOUND = "We could not find a Level 1 application with that code and email address. Check both (the code looks like AGRA-2026-K7QX4M) and try again.";

/** LEVEL2_OPEN_TO_ALL=true: every submitted Level 1 applicant may apply (code + email still checked). */
export const openToAll = () => process.env.LEVEL2_OPEN_TO_ALL === "true";
const isAllowed = async (code: string) => openToAll() || (await invitedSet()).has(code);
async function invitedSet() { return new Set((await getRepository().getLevel2Invites()).map((i) => i.level1Code)); }
async function findApplication(code: string): Promise<Application | null> {
  return (await loadApplications()).applications.find((a) => a.applicationId === code && a.submissionStatus !== "DRAFT") ?? null;
}

/** What Level 1 already knows, so nobody types it twice. The person can still correct anything. */
function prefill(a: Application): Partial<Record<keyof Level2Form, string>> {
  const age = a.applicant.age;
  const crop = ["MAIZE", "RICE", "SOYBEAN"].includes(a.business.valueChain) ? a.business.valueChain : a.business.valueChain ? "OTHER" : "";
  return {
    businessName: a.business.businessName, yearEstablished: a.business.yearStarted ? String(a.business.yearStarted) : "",
    contactName: `${a.applicant.firstName} ${a.applicant.lastName}`.replace(/\s+/g, " ").trim(), phone: a.applicant.whatsapp || a.applicant.phone, email: a.applicant.email,
    state: a.location.state, lga: a.location.lga, community: a.applicant.community, setting: a.inclusion.residenceSetting || "",
    ownerGender: a.applicant.gender, ownerAge: age ? (age < 29 ? "BELOW_29" : age <= 35 ? "29_35" : "ABOVE_35") : "",
    disability: a.inclusion.disability, cropType: crop, cropTypeOther: crop === "OTHER" ? (a.business.valueChainOther || "") : "",
    hasCac: a.business.registrationStatus === "CAC_REGISTERED" ? "YES" : a.business.registrationStatus ? "NO" : "",
    permanentEmployees: String(a.business.employees.fullTime ?? ""), casualEmployees: String(a.business.employees.partTime ?? ""),
    farmersServed: String(a.impact.farmersReached ?? ""),
  };
}

export async function startLevel2(input: { code?: unknown; email?: unknown }): Promise<ServiceResult<{ token: string; code: string; prefill: Record<string, string> }>> {
  if (closed()) return fail(403, "Level 2 applications are closed.");
  if (!(await featureOn("level2Form"))) return fail(503, OFF_MESSAGE.level2Form, { code: "FEATURE_OFF" });
  // Codes/emails pasted from email or WhatsApp often carry long dashes, spaces or invisible characters.
  const code = cleanCode(input.code), email = cleanEmail(input.email);
  if (!REFERENCE_PATTERN.test(code) || !email.includes("@")) { console.warn(`[level2] refused: code format "${code}"`); return fail(422, NOT_FOUND); }
  const a = await findApplication(code);
  if (!a) { console.warn(`[level2] refused: ${code} not found among submitted Level 1 applications`); return fail(404, NOT_FOUND); }
  if (cleanEmail(a.applicant.email) !== email) { console.warn(`[level2] refused: ${code} email does not match the Level 1 email`); return fail(404, NOT_FOUND); }
  if (!(await isAllowed(code))) return fail(403, `This Level 1 application has not been invited to Level 2. If you believe this is a mistake, write to ${PROGRAMME.contactEmail} quoting your code.`);
  const done = (await getRepository().getLevel2Applications()).find((x) => x.level1Code === code);
  if (done) return fail(409, `A Level 2 application for ${code} was already received on ${new Date(done.submittedAt).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "long" })}. Only one is allowed. Contact ${PROGRAMME.contactEmail} if something must change.`);
  return { ok: true, status: 200, data: { token: issueLevel2Token(code, email), code, prefill: prefill(a) as Record<string, string> } };
}

/** The upload endpoint uses this to accept Level 2 files only from a person holding a valid pass. */
export const level2Pass = (token: unknown) => readLevel2Token(token);

export async function submitLevel2(token: unknown, values: Record<string, unknown>): Promise<ServiceResult<{ code: string }>> {
  const pass = readLevel2Token(token);
  if (!pass) return fail(401, "Your session has expired. Please start again with your Level 1 code and email (your answers are still on this page).", { code: "PASS_EXPIRED" });
  if (closed()) return fail(403, "Level 2 applications are closed.");
  if (!(await featureOn("level2Form"))) return fail(503, OFF_MESSAGE.level2Form, { code: "FEATURE_OFF" });
  if (!(await isAllowed(pass.code))) return fail(403, "This Level 1 application is not invited to Level 2.");
  const r = validateLevel2(values);
  if (!r.ok) return fail(422, "Please fix the highlighted fields and try again.", { errors: r.errors });
  // A file kept on this server must have been uploaded with this applicant's own pass.
  for (const k of L2_DOC_FIELDS) { const m = STORED_L2_FILE.exec(r.data[k]); if (m && m[1] !== pass.code) return fail(422, "Please upload that document again.", { errors: { [k]: "Please upload this document again." } }); }
  const { declaration: _d, ...answers } = r.data;
  const app: Level2Application = { ...Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, String(v ?? "")])) as Omit<Level2Application, "level1Code" | "submittedAt" | "level1Email">,
    level1Code: pass.code, submittedAt: new Date().toISOString(), level1Email: pass.email };
  try { await getRepository().createLevel2Application(app); }
  catch (e) { if ((e as Error).message === "DUPLICATE_LEVEL2") return fail(409, `A Level 2 application for ${pass.code} was already received. Only one is allowed.`); throw e; }
  await getRepository().logEvent({ at: app.submittedAt, applicationId: pass.code, actor: "applicant", action: "LEVEL2_SUBMITTED", detail: `${app.state} | ${app.businessName}`.slice(0, 200) }).catch(() => {});
  emailLevel2Received(app);
  return { ok: true, status: 201, data: { code: pass.code } };
}

// ───────────── staff ─────────────
export async function inviteLevel2(text: unknown, actor: string, note = ""): Promise<ServiceResult<{ added: number; already: number; notFound: string[] }>> {
  const codes = [...new Set((typeof text === "string" ? text : "").toUpperCase().match(/AGRA-\d{4}-[2-9A-HJKMNP-Z]{6}/g) ?? [])];
  if (!codes.length) return fail(422, "Paste at least one Level 1 code (AGRA-2026-…). A column copied from a CSV works.");
  if (codes.length > 5000) return fail(422, "At most 5,000 codes at a time.");
  const known = new Set((await loadApplications()).applications.filter((a) => a.submissionStatus !== "DRAFT").map((a) => a.applicationId));
  const have = await invitedSet();
  const notFound = codes.filter((c) => !known.has(c));
  const fresh = codes.filter((c) => known.has(c) && !have.has(c));
  const at = new Date().toISOString();
  await getRepository().addLevel2Invites(fresh.map((c): Level2Invite => ({ level1Code: c, invitedAt: at, invitedBy: actor, note: note.slice(0, 200) })));
  if (fresh.length) await getRepository().logEvent({ at, applicationId: "-", actor, action: "LEVEL2_INVITED", detail: `${fresh.length} code(s)${note ? ` | ${note}` : ""}`.slice(0, 300) });
  return { ok: true, status: 200, data: { added: fresh.length, already: codes.length - fresh.length - notFound.length, notFound: notFound.slice(0, 50) } };
}

export async function level2Overview() {
  const [invites, subs, { applications }] = await Promise.all([getRepository().getLevel2Invites(), getRepository().getLevel2Applications(), loadApplications()]);
  const apps = new Map(applications.map((a) => [a.applicationId, a]));
  const submitted = new Set(subs.map((s) => s.level1Code));
  const invitedCodes = [...new Set(invites.map((i) => i.level1Code))];
  return {
    invited: invitedCodes.length, submitted: subs.length, closeDate: LEVEL2.closeDate(), openToAll: openToAll(),
    waiting: invitedCodes.filter((c) => !submitted.has(c)).map((c) => { const a = apps.get(c); return { code: c, name: a ? `${a.applicant.firstName} ${a.applicant.lastName}` : "", email: a?.applicant.email ?? "", state: a?.location.state ?? "" }; }),
    submissions: [...subs].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((s) => ({ code: s.level1Code, contactName: s.contactName, businessName: s.businessName, state: s.state, lga: s.lga, cropType: s.cropType === "OTHER" ? (s.cropTypeOther || "Other") : (L2_CROPS.find((c) => c.value === s.cropType)?.label ?? s.cropType), submittedAt: s.submittedAt })),
  };
}

export async function level2Csv() {
  const subs = await getRepository().getLevel2Applications();
  // Uploaded files are private: in the CSV they open through the staff file link (sign-in required).
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  const docKeys = new Set<string>(L2_DOC_FIELDS);
  const cell = (k: string, v: string) => (site && docKeys.has(k) && (v.startsWith("stored:") || v.startsWith("https://res.cloudinary.com/")) ? `${site}/api/admin/files?url=${encodeURIComponent(v)}` : v);
  const lines = [LEVEL2_COLUMNS.map(([h]) => h), ...subs.map((s) => LEVEL2_COLUMNS.map(([, k]) => cell(k, String(s[k] ?? ""))))].map((r) => r.map(csvCell).join(","));
  return { rows: subs.length, csv: "﻿" + lines.join("\r\n") + "\r\n" };
}

// ───────────── one submission (Admin → Level 2 → detail) ─────────────
export interface Level2Document { field: string; label: string; status: "file" | "link" | "missing"; href: string; source: string; note: string }
const DOC_LABELS: Array<[keyof Level2Application, string]> = [
  ["doc1", "Business proposal, pitch deck or EOP"], ["doc2", "Other supporting document"], ["doc3", "Other supporting document"],
  ["cacCertificate", "CAC certificate"], ["smedanCertificate", "SMEDAN certificate"], ["bankProof", "Bank account proof"],
];
/** Uploaded files open only through the signed-in staff viewer (permission checked, each view logged); pasted links are shown as they are. */
export function level2Documents(a: Level2Application): Level2Document[] {
  return DOC_LABELS.map(([field, label]) => {
    const v = String(a[field] ?? "").trim();
    const note = field === "cacCertificate" && a.hasCac === "YES" && !v ? "Required: the applicant said the SME has a CAC certificate." : "";
    if (!v) return { field, label, status: "missing", href: "", source: "", note };
    if (STORED_L2_FILE.test(v) || v.startsWith("https://res.cloudinary.com/"))
      return { field, label, status: "file", href: `/api/admin/files?url=${encodeURIComponent(v)}&for=${encodeURIComponent(a.level1Code)}`, source: v.startsWith("stored:") ? "Uploaded (kept on the programme server)" : "Uploaded (Cloudinary)", note };
    if (/^https:\/\/\S+$/i.test(v)) { let host = "link"; try { host = new URL(v).hostname.replace(/^www\./, ""); } catch { /* keep "link" */ } return { field, label, status: "link", href: v, source: `Link pasted by the applicant (${host})`, note }; }
    return { field, label, status: "missing", href: "", source: "", note: "The stored value is not a file or a link." };
  });
}
export async function level2Submission(code: string): Promise<Level2Application | null> {
  const c = cleanCode(code);
  if (!REFERENCE_PATTERN.test(c)) return null;
  return (await getRepository().getLevel2Applications()).find((x) => x.level1Code === c) ?? null;
}
