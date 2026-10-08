import type { MentorApplication } from "@/types/mentor";

/** STABLE HEADERS for the Mentors tab. Only append new columns on the right. */
export const MENTOR_HEADERS = [
  "mentor_id", "status", "submitted_at", "updated_at", "full_name", "email", "phone", "state", "location", "profession", "organization",
  "industry", "years_experience", "mentorship_experience", "expertise", "availability", "availability_notes", "linkedin", "portfolio",
  "motivation", "documents_json", "consent", "source", "roles", "coi_declared",
] as const;

const guard = (s: string) => (/^[=+\-@]/.test(s) ? `'${s}` : s);
const unguard = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

export const mentorToRow = (m: MentorApplication): string[] => [
  m.mentorId, m.status, m.submittedAt, m.updatedAt, guard(m.fullName), guard(m.email), guard(m.phone), m.state, guard(m.location), guard(m.profession),
  guard(m.organization), guard(m.industry), String(m.yearsExperience), guard(m.mentorshipExperience), guard(m.expertise.join("; ")), m.availability,
  guard(m.availabilityNotes), guard(m.linkedin), guard(m.portfolio), guard(m.motivation), JSON.stringify(m.documents), m.consent ? "TRUE" : "FALSE", m.source, (m.roles ?? ["MENTOR"]).join("; "), m.coiDeclared ? "TRUE" : "FALSE",
];

export function rowToMentor(r: string[]): MentorApplication {
  let documents: MentorApplication["documents"] = []; try { documents = r[20] ? JSON.parse(r[20]) : []; } catch { /* keep empty */ }
  return {
    mentorId: r[0], status: (r[1] || "NEW") as MentorApplication["status"], submittedAt: r[2], updatedAt: r[3], fullName: unguard(r[4] ?? ""), email: unguard(r[5] ?? ""),
    phone: unguard(r[6] ?? ""), state: r[7] ?? "", location: unguard(r[8] ?? ""), profession: unguard(r[9] ?? ""), organization: unguard(r[10] ?? ""),
    industry: unguard(r[11] ?? ""), yearsExperience: Number(r[12]) || 0, mentorshipExperience: unguard(r[13] ?? ""),
    expertise: r[14] ? unguard(r[14]).split("; ") : [], availability: r[15] ?? "", availabilityNotes: unguard(r[16] ?? ""), linkedin: unguard(r[17] ?? ""),
    portfolio: unguard(r[18] ?? ""), motivation: unguard(r[19] ?? ""), documents, consent: (r[21] ?? "").toUpperCase() === "TRUE", source: r[22] ?? "web",
    roles: r[23] ? r[23].split("; ") : ["MENTOR"], coiDeclared: (r[24] ?? "").toUpperCase() === "TRUE",
  };
}
